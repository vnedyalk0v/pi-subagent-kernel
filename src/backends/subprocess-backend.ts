import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join, resolve, sep } from "node:path";
import { StringDecoder } from "node:string_decoder";

import {
  parseRunStatus,
  parseSpawnInput,
  runStatusFromEnvelope,
  type ExecutionBackend,
  type RunStatus,
  type SpawnInput,
} from "../contracts/execution-backend.ts";
import { parseRunEnvelope, type RunEnvelope } from "../contracts/run-envelope.ts";

const READ_ONLY_PI_TOOLS = Object.freeze(["read", "grep", "find", "ls"] as const);
const MAX_CAPTURE_BYTES = 64 * 1024;
const MAX_STDOUT_LINE_BYTES = 1024 * 1024;
const MAX_TIMEOUT_MS = 2_147_483_647;
const RPC_THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh"]);
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "expired"]);
const RPC_STDOUT_METADATA_KEYS = new Set(["type", "id", "command", "success", "toolName", "toolCallId", "isError", "status"]);
const CHILD_SYSTEM_PROMPT = "You are an isolated Pi SubAgent Kernel child. Follow the user prompt and return only the requested JSON RunEnvelope.";

export interface SubprocessExecutionBackendOptions {
  command?: string;
  args?: readonly string[] | ((input: SpawnInput) => readonly string[]);
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  killGraceMs?: number;
}

type FinishReason = "agent_end" | "exit" | "error" | "cancelled" | "timeout" | "rpc_rejected";

interface SubprocessRun {
  input: SpawnInput;
  child: ChildProcessWithoutNullStreams;
  startedAt: string;
  status: RunStatus;
  stdout: string;
  stderr: string;
  parseStdout: string;
  stdoutBuffer: string;
  discardingStdoutLine: boolean;
  finalText?: string;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  timedOut: boolean;
  cancelReason?: string;
  rpcError?: string;
  promptCommand: string;
  promptSent: boolean;
  finished: boolean;
  exited: boolean;
  timeout: NodeJS.Timeout;
  hardKill?: NodeJS.Timeout;
  resolve: (result: RunEnvelope) => void;
  result: Promise<RunEnvelope>;
}

export class SubprocessExecutionBackend implements ExecutionBackend {
  readonly id = "subprocess" as const;

  readonly #command: string;
  readonly #args: readonly string[] | ((input: SpawnInput) => readonly string[]);
  readonly #cwd: string | undefined;
  readonly #env: NodeJS.ProcessEnv | undefined;
  readonly #now: () => Date;
  readonly #killGraceMs: number;
  readonly #runs = new Map<string, SubprocessRun>();

  constructor(options: SubprocessExecutionBackendOptions = {}) {
    const trustRoot = options.cwd ? resolve(options.cwd) : process.cwd();
    this.#command = options.command ?? (process.platform === "win32" ? resolveSystem32Command("cmd.exe") : resolvePiCommand(["pi"], trustRoot));
    this.#args = options.args ?? (process.platform === "win32" && options.command === undefined
      ? (input: SpawnInput) => buildWindowsPiRpcArgs(input, trustRoot)
      : buildPiRpcArgs);
    this.#cwd = options.cwd;
    this.#env = options.env ?? minimalEnv(trustRoot);
    this.#now = options.now ?? (() => new Date());
    this.#killGraceMs = options.killGraceMs ?? 500;
  }

  async spawn(input: SpawnInput): Promise<RunStatus> {
    const normalized = parseSpawnInput(input);
    if (this.#runs.has(normalized.runId)) {
      throw new Error(`Duplicate subprocess run "${normalized.runId}".`);
    }

    if (normalized.context.mode === "fork") {
      throw new Error("context.mode fork is not supported by the subprocess alpha backend.");
    }
    if ((normalized.policy.filesystem === "none" || normalized.agent.sandbox.filesystem === "none") && normalized.context.files.length > 0) {
      throw new Error("context.files are not supported when filesystem access is none.");
    }

    const thinkingCommand = buildThinkingCommand(normalized);
    const promptCommand = buildPromptCommand(normalized);
    const startedAt = this.#now().toISOString();
    const status = parseRunStatus({
      id: normalized.runId,
      agent: normalized.agent.name,
      runtime: this.id,
      status: "running",
      startedAt,
      summary: `Subprocess ${normalized.agent.name} running.`,
    });

    let resolve!: (result: RunEnvelope) => void;
    const result = new Promise<RunEnvelope>((done) => {
      resolve = done;
    });
    const timeoutMs = toTimeoutMs(normalized.limits.maxRuntimeSec);
    const child = spawn(this.#command, this.#resolveArgs(normalized), {
      cwd: this.#cwd,
      detached: process.platform !== "win32",
      env: this.#env,
      stdio: "pipe",
    });
    const timeout = setTimeout(() => this.#timeout(normalized.runId), timeoutMs);
    const run: SubprocessRun = {
      input: normalized,
      child,
      startedAt,
      status,
      stdout: "",
      stderr: "",
      parseStdout: "",
      stdoutBuffer: "",
      discardingStdoutLine: false,
      timedOut: false,
      promptCommand,
      promptSent: false,
      finished: false,
      exited: false,
      timeout,
      resolve,
      result,
    };
    this.#runs.set(normalized.runId, run);
    this.#attach(run);

    if (thinkingCommand) {
      this.#writeRpc(run, thinkingCommand);
    } else {
      this.#sendPrompt(run);
    }
    return status;
  }

  async status(runId: string): Promise<RunStatus> {
    return this.#get(runId).status;
  }

  async result(runId: string): Promise<RunEnvelope> {
    return this.#get(runId).result;
  }

  async cancel(runId: string, reason = "Cancellation requested."): Promise<RunStatus> {
    const run = this.#get(runId);
    if (run.finished) {
      return run.status;
    }

    run.cancelReason = reason;
    this.#terminate(run);
    return runStatusFromEnvelope(await run.result);
  }

  #resolveArgs(input: SpawnInput): readonly string[] {
    return typeof this.#args === "function" ? this.#args(input) : this.#args;
  }

  #attach(run: SubprocessRun): void {
    const decoder = new StringDecoder("utf8");

    run.child.stdout.on("data", (chunk: Buffer) => {
      const text = decoder.write(chunk);
      run.stdout = appendCapture(run.stdout, text);
      run.parseStdout = appendParseCapture(run.parseStdout, text);
      this.#appendStdoutBuffer(run, text);
    });
    run.child.stdout.on("end", () => {
      const text = decoder.end();
      if (text) {
        run.stdout = appendCapture(run.stdout, text);
        run.parseStdout = appendParseCapture(run.parseStdout, text);
        this.#appendStdoutBuffer(run, text);
      }
      this.#handleStdoutLine(run, run.stdoutBuffer);
      run.stdoutBuffer = "";
    });
    run.child.stderr.on("data", (chunk: Buffer) => {
      run.stderr = appendCapture(run.stderr, chunk.toString("utf8"));
    });
    run.child.stdin.on("error", (error) => {
      if (!run.finished && !run.timedOut && !run.cancelReason) {
        this.#finish(run, "error", { error });
        this.#terminate(run, false);
      }
    });
    run.child.on("error", (error) => this.#finish(run, "error", { error }));
    run.child.on("exit", (code, signal) => {
      run.exited = true;
      run.exitCode = code;
      run.signal = signal;
      this.#terminate(run, false);
    });
    run.child.on("close", (code, signal) => {
      if (!run.exited) {
        run.exited = true;
        run.exitCode = code;
        run.signal = signal;
      }
      if (!run.finished) {
        this.#finish(run, run.timedOut ? "timeout" : run.cancelReason ? "cancelled" : "exit");
        this.#terminate(run, false);
      }
    });
  }

  #appendStdoutBuffer(run: SubprocessRun, text: string): void {
    let rest = text;
    while (rest) {
      if (run.discardingStdoutLine) {
        const newlineIndex = rest.indexOf("\n");
        if (newlineIndex === -1) {
          return;
        }
        rest = rest.slice(newlineIndex + 1);
        run.discardingStdoutLine = false;
      }

      const newlineIndex = rest.indexOf("\n");
      const fragment = newlineIndex === -1 ? rest : rest.slice(0, newlineIndex + 1);
      if (run.stdoutBuffer.length + fragment.length > MAX_STDOUT_LINE_BYTES) {
        run.stdoutBuffer = "";
        run.discardingStdoutLine = newlineIndex === -1;
        rest = newlineIndex === -1 ? "" : rest.slice(newlineIndex + 1);
        continue;
      }

      run.stdoutBuffer += fragment;
      if (newlineIndex === -1) {
        return;
      }
      rest = rest.slice(newlineIndex + 1);
      this.#handleStdoutLine(run, run.stdoutBuffer.slice(0, -1).replace(/\r$/, ""));
      run.stdoutBuffer = "";
    }
  }

  #handleStdoutLine(run: SubprocessRun, line: string): void {
    if (!line.trim()) {
      return;
    }
    const event = parseJsonObject(line);
    if (run.timedOut || run.cancelReason) {
      return;
    }
    if (event?.type === "response" && (event.command === "prompt" || event.command === "set_thinking_level")) {
      if (event.success === false) {
        run.rpcError = `RPC ${String(event.command)} command was rejected.`;
        this.#finish(run, "rpc_rejected");
        this.#terminate(run, false);
        return;
      }
      if (event.command === "set_thinking_level") {
        this.#sendPrompt(run);
      }
      return;
    }
    if (event?.type !== "agent_end") {
      return;
    }

    const finalText = extractAssistantText(event.messages);
    if (finalText !== undefined) {
      run.finalText = finalText;
    }
    this.#finish(run, "agent_end");
    this.#terminate(run, false);
  }

  #sendPrompt(run: SubprocessRun): void {
    if (run.promptSent || run.finished || run.timedOut || run.cancelReason) {
      return;
    }
    run.promptSent = true;
    this.#writeRpc(run, run.promptCommand);
  }

  #writeRpc(run: SubprocessRun, command: string): void {
    run.child.stdin.write(command, (error) => {
      if (error && !run.finished && !run.timedOut && !run.cancelReason) {
        this.#finish(run, "error", { error });
        this.#terminate(run, false);
      }
    });
  }

  #timeout(runId: string): void {
    const run = this.#runs.get(runId);
    if (!run || run.finished || run.cancelReason) {
      return;
    }
    run.timedOut = true;
    this.#terminate(run);
  }

  #terminate(run: SubprocessRun, writeAbort = true): void {
    if (writeAbort && run.child.stdin.writable) {
      run.child.stdin.write(`${JSON.stringify({ id: `${run.input.runId}:abort`, type: "abort" })}\n`);
    }
    if (!run.child.stdin.destroyed && !run.child.stdin.writableEnded) {
      run.child.stdin.end();
    }
    killChild(run, "SIGTERM");
    run.hardKill ??= setTimeout(() => {
      killChild(run, "SIGKILL");
    }, this.#killGraceMs);
  }

  #finish(run: SubprocessRun, reason: FinishReason, options: { error?: Error } = {}): void {
    if (run.finished) {
      return;
    }

    run.finished = true;
    clearTimeout(run.timeout);
    const endedAt = this.#now().toISOString();
    const envelope = this.#envelope(run, reason, endedAt, options.error);
    run.status = runStatusFromEnvelope(envelope);
    run.resolve(envelope);
  }

  #envelope(run: SubprocessRun, reason: FinishReason, endedAt: string, spawnError?: Error): RunEnvelope {
    if (reason === "agent_end" || reason === "exit") {
      const parsed = this.#parseChildResult(run, endedAt);
      if (parsed && !(reason === "exit" && run.exitCode !== 0 && parsed.status !== "failed" && parsed.status !== "expired")) {
        return parsed;
      }
      if (reason === "agent_end" || run.exitCode === 0) {
        return this.#failed(run, endedAt, "SUBPROCESS_INVALID_RESULT", "Subprocess output did not contain a valid RunEnvelope.", false);
      }
    }
    if (reason === "timeout") {
      return this.#failed(run, endedAt, "SUBPROCESS_TIMEOUT", "Subprocess exceeded maxRuntimeSec and was terminated.", true, "expired");
    }
    if (reason === "rpc_rejected") {
      return this.#failed(run, endedAt, "SUBPROCESS_RPC_PROMPT_REJECTED", run.rpcError ?? "RPC prompt command was rejected.", false);
    }
    if (reason === "cancelled") {
      return this.#base(run, endedAt, {
        status: "cancelled",
        summary: `Subprocess ${run.input.agent.name} cancelled: ${run.cancelReason ?? "Cancellation requested."}`,
        confidence: 0,
      });
    }
    return this.#failed(
      run,
      endedAt,
      spawnError ? "SUBPROCESS_SPAWN_FAILED" : "SUBPROCESS_EXIT_NONZERO",
      spawnError?.message ?? `Subprocess exited with code ${run.exitCode ?? "null"}.`,
      false,
    );
  }

  #parseChildResult(run: SubprocessRun, endedAt: string): RunEnvelope | undefined {
    const text = run.finalText ?? run.parseStdout.trim();
    if (!text) {
      return undefined;
    }
    try {
      const candidate = parseRunEnvelope(JSON.parse(text));
      if (!TERMINAL_STATUSES.has(candidate.status)) {
        return undefined;
      }
      const { parentRunId: _parentRunId, error: childError, ...trustedCandidate } = candidate;
      const childFailed = candidate.status === "failed" || candidate.status === "expired";
      if (childFailed) {
        return parseRunEnvelope({
          id: run.input.runId,
          ...(run.input.context.parentRunId !== undefined ? { parentRunId: run.input.context.parentRunId } : {}),
          agent: run.input.agent.name,
          runtime: this.id,
          contextMode: run.input.context.mode,
          status: candidate.status,
          startedAt: run.startedAt,
          endedAt,
          summary: "Child subprocess reported failure.",
          findings: [],
          artifacts: [],
          filesRead: run.input.context.files,
          filesChanged: [],
          commandsRun: [this.#command],
          testsRun: [],
          cost: candidate.cost,
          confidence: 0,
          nextActions: [],
          error: sanitizeChildError(childError ?? { code: "CHILD_FAILED", message: "Child subprocess reported failure.", retryable: false }),
        });
      }
      return parseRunEnvelope({
        ...trustedCandidate,
        id: run.input.runId,
        ...(run.input.context.parentRunId !== undefined ? { parentRunId: run.input.context.parentRunId } : {}),
        agent: run.input.agent.name,
        runtime: this.id,
        contextMode: run.input.context.mode,
        startedAt: run.startedAt,
        endedAt,
        status: candidate.status,
      });
    } catch {
      return undefined;
    }
  }

  #failed(
    run: SubprocessRun,
    endedAt: string,
    code: string,
    message: string,
    retryable: boolean,
    status: "failed" | "expired" = "failed",
  ): RunEnvelope {
    return this.#base(run, endedAt, {
      status,
      summary: message,
      confidence: 0,
      error: {
        code,
        message,
        retryable,
        details: {
          exitCode: run.exitCode ?? null,
          signal: run.signal ?? null,
          stdout: redactRpcStdout(run.stdout),
          stderr: run.stderr ? "[redacted]" : "",
        },
      },
    });
  }

  #base(
    run: SubprocessRun,
    endedAt: string,
    overrides: Pick<RunEnvelope, "status" | "summary" | "confidence"> & { error?: RunEnvelope["error"] },
  ): RunEnvelope {
    return parseRunEnvelope({
      id: run.input.runId,
      ...(run.input.context.parentRunId !== undefined ? { parentRunId: run.input.context.parentRunId } : {}),
      agent: run.input.agent.name,
      runtime: this.id,
      contextMode: run.input.context.mode,
      status: overrides.status,
      startedAt: run.startedAt,
      endedAt,
      summary: overrides.summary,
      findings: [],
      artifacts: [],
      filesRead: run.input.context.files,
      filesChanged: [],
      commandsRun: [this.#command],
      testsRun: [],
      cost: { estimatedUsd: null },
      confidence: overrides.confidence,
      nextActions: [],
      ...(overrides.error !== undefined ? { error: overrides.error } : {}),
    });
  }

  #get(runId: string): SubprocessRun {
    const run = this.#runs.get(runId);
    if (!run) {
      throw new Error(`Unknown subprocess run "${runId}".`);
    }
    return run;
  }
}

export function buildWindowsPiRpcArgs(input: SpawnInput, trustRoot = process.cwd()): readonly string[] {
  if (input.agent.model !== "inherit" && !/^[\w./:@+-]+$/u.test(input.agent.model)) {
    throw new Error("agent.model contains characters unsafe for the default Windows Pi launcher.");
  }
  const command = [resolveWindowsPiCommand(trustRoot), ...buildPiRpcArgs(input)].map(quoteWindowsCmdArg).join(" ");
  return ["/d", "/s", "/c", `"${command}"`];
}

function quoteWindowsCmdArg(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function resolveWindowsPiCommand(trustRoot: string): string {
  const extensions = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  return resolvePiCommand(extensions.map((extension) => `pi${extension.toLowerCase()}`), trustRoot);
}

function resolveSystem32Command(name: string): string {
  const root = process.env.SystemRoot ?? process.env.windir;
  if (!root || !isAbsolute(root)) {
    throw new Error(`Unable to resolve Windows system command ${name}.`);
  }
  const command = join(root, "System32", name);
  if (!existsSync(command)) {
    throw new Error(`Unable to resolve Windows system command ${name}.`);
  }
  return command;
}

function resolvePiCommand(names: readonly string[], trustRoot = process.cwd()): string {
  for (const rawDir of (process.env.PATH ?? "").split(delimiter)) {
    const dir = rawDir.replace(/^"|"$/g, "");
    if (!isTrustedPathDir(dir, trustRoot)) {
      continue;
    }
    for (const name of names) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  throw new Error("Unable to resolve a trusted Pi command from PATH for the default subprocess backend.");
}

function isTrustedPathDir(dir: string, trustRoot = process.cwd()): boolean {
  const cleanDir = dir.replace(/^"|"$/g, "");
  if (!cleanDir || !isAbsolute(cleanDir)) {
    return false;
  }
  const resolvedDir = normalizeTrustPath(resolve(cleanDir));
  const cwd = normalizeTrustPath(resolve(trustRoot));
  return resolvedDir !== cwd && !resolvedDir.startsWith(`${cwd}${sep}`);
}

function normalizeTrustPath(path: string): string {
  return process.platform === "win32" ? path.toLowerCase() : path;
}

export function buildPiRpcArgs(input: SpawnInput): readonly string[] {
  const tools = input.policy.filesystem === "none" || input.agent.sandbox.filesystem === "none"
    ? []
    : READ_ONLY_PI_TOOLS.filter((tool) => input.agent.tools.includes(tool) && !input.agent.disallowedTools.includes(tool));
  const args = [
    "--mode",
    "rpc",
    "--no-session",
    "--no-approve",
    "--offline",
    "--no-context-files",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--system-prompt",
    CHILD_SYSTEM_PROMPT,
  ];
  const modelArgs = input.agent.model === "inherit" ? [] : ["--model", input.agent.model];
  return tools.length > 0 ? [...args, ...modelArgs, "--tools", tools.join(",")] : [...args, ...modelArgs, "--no-tools"];
}

function buildThinkingCommand(input: SpawnInput): string | undefined {
  const thinking = input.agent.thinking ?? input.agent.reasoning;
  if (!thinking) {
    return undefined;
  }
  if (!RPC_THINKING_LEVELS.has(thinking)) {
    throw new Error(`agent.thinking "${thinking}" is not supported by Pi RPC subprocess mode.`);
  }
  return `${JSON.stringify({ id: `${input.runId}:thinking`, type: "set_thinking_level", level: thinking })}\n`;
}

function buildPromptCommand(input: SpawnInput): string {
  return `${JSON.stringify({ id: `${input.runId}:prompt`, type: "prompt", message: buildChildPrompt(input) })}\n`;
}

function sanitizeChildError(error: NonNullable<RunEnvelope["error"]>): NonNullable<RunEnvelope["error"]> {
  return {
    code: "CHILD_SUBPROCESS_FAILED",
    message: "Child subprocess reported failure.",
    retryable: error.retryable,
    ...(error.details !== undefined ? { details: { redacted: true } } : {}),
  };
}

function buildChildPrompt(input: SpawnInput): string {
  return [
    "You are running as an isolated Pi SubAgent Kernel child process.",
    "Do not reveal hidden reasoning. Return only one JSON RunEnvelope.",
    `Run ID: ${input.runId}`,
    `Agent: ${input.agent.name}`,
    `Runtime: subprocess`,
    `Context mode: ${input.context.mode}`,
    input.context.summary ? `Parent summary:\n${input.context.summary}` : "Parent summary: <none>",
    input.context.files.length > 0 ? `File hints:\n${input.context.files.join("\n")}` : "File hints: <none>",
    `Output mode: ${input.output.mode}`,
    input.output.schema === undefined
      ? "Output schema: <none>"
      : `Output schema:\n${typeof input.output.schema === "string" ? input.output.schema : JSON.stringify(input.output.schema)}`,
    input.output.artifactPath ? `Output artifact path: ${input.output.artifactPath}` : "Output artifact path: <none>",
    `Agent instructions:\n${input.agent.instructions}`,
    `Task:\n${input.task}`,
  ].join("\n\n");
}

function extractAssistantText(messages: unknown): string | undefined {
  if (!Array.isArray(messages)) {
    return undefined;
  }
  const message = messages[messages.length - 1];
  if (!isRecord(message) || message.role !== "assistant") {
    return undefined;
  }
  if (typeof message.content === "string") {
    return message.content.trim() || undefined;
  }
  if (Array.isArray(message.content)) {
    const text = message.content
      .flatMap((item) => (isRecord(item) && item.type === "text" && typeof item.text === "string" ? [item.text] : []))
      .join("")
      .trim();
    return text || undefined;
  }
  return undefined;
}

function parseJsonObject(line: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(line);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function appendCapture(current: string, chunk: string): string {
  const next = current + chunk;
  return next.length <= MAX_CAPTURE_BYTES ? next : `${next.slice(0, MAX_CAPTURE_BYTES)}\n[truncated]`;
}

function appendParseCapture(current: string, chunk: string): string {
  const next = current + chunk;
  return next.length <= MAX_STDOUT_LINE_BYTES ? next : next.slice(0, MAX_STDOUT_LINE_BYTES);
}

function trustedPathEnv(trustRoot = process.cwd()): NodeJS.ProcessEnv {
  const path = (process.env.PATH ?? "")
    .split(delimiter)
    .filter((entry) => isTrustedPathDir(entry, trustRoot))
    .join(delimiter);
  return path ? { PATH: path } : {};
}

function minimalEnv(trustRoot = process.cwd()): NodeJS.ProcessEnv {
  return {
    ...trustedPathEnv(trustRoot),
    ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
    ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
    ...(process.env.PI_CODING_AGENT_DIR ? { PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR } : {}),
    PI_TELEMETRY: "0",
  };
}

function killChild(run: SubprocessRun, signal: NodeJS.Signals): void {
  try {
    if (process.platform !== "win32" && run.child.pid) {
      process.kill(-run.child.pid, signal);
      return;
    }
    if (process.platform === "win32" && run.child.pid) {
      const args = ["/pid", String(run.child.pid), "/t", ...(signal === "SIGKILL" ? ["/f"] : [])];
      const killer = spawn(resolveSystem32Command("taskkill.exe"), args, { stdio: "ignore", windowsHide: true });
      killer.on("error", () => undefined);
      killer.unref();
    }
    run.child.kill(signal);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ESRCH" && code !== "EPERM") {
      throw error;
    }
  }
}

function redactRpcStdout(stdout: string): string {
  return stdout
    .split("\n")
    .map((line) => {
      const event = parseJsonObject(line);
      if (!event) {
        return line.trimStart().startsWith("{") ? "[redacted malformed JSONL]" : line.trim() ? "[redacted]" : line;
      }
      return JSON.stringify(redactStructuredStdoutEvent(event));
    })
    .join("\n");
}

function redactStructuredStdoutEvent(event: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(event).map(([key, value]) => [key, RPC_STDOUT_METADATA_KEYS.has(key) && isJsonPrimitive(value) ? value : "[redacted]"]),
  );
}

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function toTimeoutMs(maxRuntimeSec: number): number {
  const timeoutMs = maxRuntimeSec * 1000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`limits.maxRuntimeSec must be ${Math.floor(MAX_TIMEOUT_MS / 1000)} seconds or less for subprocess runs.`);
  }
  return timeoutMs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
