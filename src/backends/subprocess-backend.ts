import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join, resolve } from "node:path";
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
    this.#command = options.command ?? (process.platform === "win32" ? "cmd.exe" : "pi");
    this.#args = options.args ?? (process.platform === "win32" && options.command === undefined ? buildWindowsPiRpcArgs : buildPiRpcArgs);
    this.#cwd = options.cwd;
    this.#env = options.env;
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
      env: this.#env ?? minimalEnv(),
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
      this.#appendStdoutBuffer(run, text);
    });
    run.child.stdout.on("end", () => {
      const text = decoder.end();
      if (text) {
        run.stdout = appendCapture(run.stdout, text);
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
    run.child.on("close", (code, signal) => {
      run.exited = true;
      run.exitCode = code;
      run.signal = signal;
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
        run.rpcError = typeof event.error === "string" ? event.error : `RPC ${String(event.command)} command was rejected.`;
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
    if (process.platform !== "win32" || !run.exited) {
      killChild(run, "SIGTERM");
    }
    run.hardKill ??= setTimeout(() => {
      if (process.platform !== "win32" || !run.exited) {
        killChild(run, "SIGKILL");
      }
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
    if (reason === "agent_end" || (reason === "exit" && run.exitCode === 0)) {
      const parsed = this.#parseChildResult(run, endedAt);
      if (parsed) {
        return parsed;
      }
      return this.#failed(run, endedAt, "SUBPROCESS_INVALID_RESULT", "Subprocess output did not contain a valid RunEnvelope.", false);
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
    const text = run.finalText ?? run.stdout.trim();
    if (!text) {
      return undefined;
    }
    try {
      const candidate = parseRunEnvelope(JSON.parse(text));
      if (!TERMINAL_STATUSES.has(candidate.status)) {
        return undefined;
      }
      const { parentRunId: _parentRunId, ...trustedCandidate } = candidate;
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
          stderr: run.stderr,
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

function buildWindowsPiRpcArgs(input: SpawnInput): readonly string[] {
  if (input.agent.model !== "inherit" && !/^[\w./:@+-]+$/u.test(input.agent.model)) {
    throw new Error("agent.model contains characters unsafe for the default Windows Pi launcher.");
  }
  return ["/d", "/s", "/c", resolveWindowsPiCommand(), ...buildPiRpcArgs(input)];
}

function resolveWindowsPiCommand(): string {
  const extensions = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  for (const rawDir of (process.env.PATH ?? "").split(delimiter)) {
    const dir = rawDir.replace(/^"|"$/g, "");
    if (!dir || !isAbsolute(dir) || resolve(dir) === process.cwd()) {
      continue;
    }
    for (const extension of extensions) {
      const candidate = join(dir, `pi${extension.toLowerCase()}`);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  throw new Error("Unable to resolve a trusted Pi command from PATH for the default Windows subprocess backend.");
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
  let message: unknown;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (isRecord(item) && item.role === "assistant") {
      message = item;
      break;
    }
  }
  if (!isRecord(message)) {
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

function minimalEnv(): NodeJS.ProcessEnv {
  return {
    ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
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
      const killer = spawn("taskkill", args, { stdio: "ignore", windowsHide: true });
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
        return line.trimStart().startsWith("{") ? "[redacted malformed JSONL]" : line;
      }
      for (const key of ["message", "messages", "assistantMessageEvent", "partialResult", "result", "toolResults"]) {
        if (Object.hasOwn(event, key)) {
          event[key] = "[redacted]";
        }
      }
      return JSON.stringify(event);
    })
    .join("\n");
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
