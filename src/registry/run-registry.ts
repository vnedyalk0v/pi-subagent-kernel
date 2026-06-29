import { randomUUID } from "node:crypto";

import { parseRunStatus, type ExecutionBackendId, type RunStatus } from "../contracts/execution-backend.ts";
import { RUN_ENVELOPE_RUNTIMES, parseRunEnvelope, type RunArtifactRef, type RunEnvelope, type RunError } from "../contracts/run-envelope.ts";
import { RUN_STATES, type RunState } from "../contracts/run-state.ts";
import type { ValidationIssue } from "../contracts/agent-definition.ts";

const TERMINAL_STATES = new Set<RunState>(["completed", "failed", "cancelled", "expired"]);
const ACTIVE_STATES = new Set<RunState>(["starting", "running", "waiting_for_input"]);

const ALLOWED_TRANSITIONS: Record<RunState, readonly RunState[]> = {
  queued: ["starting", "cancelled"],
  starting: ["running", "failed", "cancelled", "expired"],
  running: ["waiting_for_input", "completed", "failed", "cancelled", "expired"],
  waiting_for_input: ["running", "completed", "failed", "cancelled", "expired"],
  completed: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export interface CreateRunInput {
  id?: string;
  agent: string;
  task: string;
  runtime?: ExecutionBackendId;
  parentRunId?: string | null;
  summary?: string;
}

export interface RunUpdate {
  runtime?: ExecutionBackendId;
  summary?: string;
  error?: RunError;
}

export interface RunRecord {
  id: string;
  agent: string;
  task: string;
  status: RunState;
  createdAt: string;
  runtime?: ExecutionBackendId;
  parentRunId?: string | null;
  startedAt?: string;
  endedAt?: string;
  summary?: string;
  error?: RunError;
  artifacts: RunArtifactRef[];
  result?: RunEnvelope;
}

export interface RunRegistryOptions {
  idGenerator?: () => string;
  now?: () => Date;
}

export class RunRegistryValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(kind: string, issues: ValidationIssue[]) {
    super(`Invalid ${kind}: ${issues.map(formatIssue).join("; ")}`);
    this.name = "RunRegistryValidationError";
    this.issues = issues;
  }
}

export class DuplicateRunIdError extends Error {
  readonly runId: string;

  constructor(runId: string) {
    super(`Duplicate run ID "${runId}".`);
    this.name = "DuplicateRunIdError";
    this.runId = runId;
  }
}

export class RunNotFoundError extends Error {
  readonly runId: string;

  constructor(runId: string) {
    super(`Unknown run ID "${runId}".`);
    this.name = "RunNotFoundError";
    this.runId = runId;
  }
}

export class InvalidRunTransitionError extends Error {
  readonly runId: string;
  readonly from: RunState;
  readonly to: RunState;

  constructor(runId: string, from: RunState, to: RunState) {
    super(`Invalid run transition for "${runId}": ${from} -> ${to}.`);
    this.name = "InvalidRunTransitionError";
    this.runId = runId;
    this.from = from;
    this.to = to;
  }
}

/** In-memory run lifecycle registry. Active runs are not durable across process restarts. */
export class RunRegistry {
  readonly #runs = new Map<string, RunRecord>();
  readonly #idGenerator: () => string;
  readonly #now: () => Date;

  constructor(options: RunRegistryOptions = {}) {
    this.#idGenerator = options.idGenerator ?? createRunId;
    this.#now = options.now ?? (() => new Date());
  }

  create(input: CreateRunInput): RunRecord {
    const parsed = parseCreateRunInput(input);
    const id = parseRunId(parsed.id ?? this.#idGenerator(), "id");

    if (this.#runs.has(id)) {
      throw new DuplicateRunIdError(id);
    }

    const record = deepFreeze<RunRecord>({
      id,
      agent: parsed.agent,
      task: parsed.task,
      status: "queued",
      createdAt: this.#timestamp(),
      ...(parsed.runtime !== undefined ? { runtime: parsed.runtime } : {}),
      ...(parsed.parentRunId !== undefined ? { parentRunId: parsed.parentRunId } : {}),
      ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
      artifacts: [],
    });
    this.#runs.set(id, record);
    return record;
  }

  get(runId: string): RunRecord | undefined {
    return this.#runs.get(parseRunId(runId, "runId"));
  }

  status(runId: string): RunStatus {
    return toRunStatus(this.#require(runId));
  }

  updateState(runId: string, nextState: RunState, update: RunUpdate = {}): RunRecord {
    const id = parseRunId(runId, "runId");
    const state = parseNextState(nextState);
    const patch = parseRunUpdate(update);
    const current = this.#require(id);

    const timestamp = this.#timestamp();
    if (current.runtime && patch.runtime && patch.runtime !== current.runtime) {
      throw new RunRegistryValidationError("run transition", [{ path: "runtime", message: `runtime is already ${current.runtime}.` }]);
    }
    const runtime = current.runtime ?? patch.runtime;
    const error = patch.error ?? current.error;
    assertTransition(current, state, runtime, error);

    const startedAt = current.startedAt ?? (ACTIVE_STATES.has(state) || (TERMINAL_STATES.has(state) && runtime) ? timestamp : undefined);
    const endedAt = TERMINAL_STATES.has(state) ? timestamp : undefined;

    const next = deepFreeze<RunRecord>({
      ...current,
      ...patch,
      status: state,
      ...(runtime !== undefined ? { runtime } : {}),
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(endedAt !== undefined ? { endedAt } : {}),
    });

    this.#runs.set(id, next);
    return next;
  }

  storeResult(input: unknown): RunEnvelope {
    const envelope = parseRunEnvelope(input);
    const current = this.#require(envelope.id);

    if (current.result) {
      throw new RunRegistryValidationError("run result", [{ path: "id", message: `Result already stored for ${envelope.id}.` }]);
    }
    if (!TERMINAL_STATES.has(envelope.status)) {
      throw new RunRegistryValidationError("run result", [{ path: "status", message: "Result envelope status must be terminal." }]);
    }
    if (envelope.agent !== current.agent) {
      throw new RunRegistryValidationError("run result", [{ path: "agent", message: `Result agent must match run agent ${current.agent}.` }]);
    }
    if (current.runtime && envelope.runtime !== current.runtime) {
      throw new RunRegistryValidationError("run result", [{ path: "runtime", message: `Result runtime must match run runtime ${current.runtime}.` }]);
    }
    if (current.parentRunId !== undefined && envelope.parentRunId !== undefined && envelope.parentRunId !== current.parentRunId) {
      throw new RunRegistryValidationError("run result", [{ path: "parentRunId", message: "Result parentRunId must match the run record." }]);
    }
    if (current.status !== envelope.status) {
      assertTransition(current, envelope.status, envelope.runtime, envelope.error);
    }

    const record = deepFreeze<RunRecord>({
      ...current,
      status: envelope.status,
      runtime: envelope.runtime,
      ...(envelope.parentRunId !== undefined ? { parentRunId: envelope.parentRunId } : {}),
      ...(envelope.startedAt !== undefined ? { startedAt: envelope.startedAt } : {}),
      ...(envelope.endedAt !== undefined ? { endedAt: envelope.endedAt } : {}),
      summary: envelope.summary,
      artifacts: envelope.artifacts,
      ...(envelope.error !== undefined ? { error: envelope.error } : {}),
      result: envelope,
    });

    this.#runs.set(envelope.id, record);
    return envelope;
  }

  result(runId: string): RunEnvelope | undefined {
    return this.#require(runId).result;
  }

  #require(runId: string): RunRecord {
    const id = parseRunId(runId, "runId");
    const run = this.#runs.get(id);
    if (!run) {
      throw new RunNotFoundError(id);
    }
    return run;
  }

  #timestamp(): string {
    return this.#now().toISOString();
  }
}

function createRunId(): string {
  return `run_${randomUUID()}`;
}

function toRunStatus(record: RunRecord): RunStatus {
  return parseRunStatus({
    id: record.id,
    agent: record.agent,
    ...(record.runtime !== undefined ? { runtime: record.runtime } : {}),
    status: record.status,
    ...(record.startedAt !== undefined ? { startedAt: record.startedAt } : {}),
    ...(record.endedAt !== undefined ? { endedAt: record.endedAt } : {}),
    ...(record.summary !== undefined ? { summary: record.summary } : {}),
  });
}

function assertTransition(current: RunRecord, to: RunState, runtime?: ExecutionBackendId, error?: RunError): void {
  if (!ALLOWED_TRANSITIONS[current.status].includes(to)) {
    throw new InvalidRunTransitionError(current.id, current.status, to);
  }
  if (ACTIVE_STATES.has(to) && !runtime) {
    throw new RunRegistryValidationError("run transition", [{ path: "runtime", message: `runtime is required before moving to ${to}.` }]);
  }
  if ((to === "failed" || to === "expired") && !error) {
    throw new RunRegistryValidationError("run transition", [{ path: "error", message: `${to} runs require a structured error.` }]);
  }
  if (error && to !== "failed" && to !== "expired") {
    throw new RunRegistryValidationError("run transition", [{ path: "error", message: "error is allowed only for failed or expired runs." }]);
  }
}

function parseCreateRunInput(input: CreateRunInput): CreateRunInput {
  if (!isRecord(input)) {
    fail("run", "$", "Run must be an object.");
  }

  const id = input.id === undefined ? undefined : readString(input.id, "id", "run");
  const agent = readString(input.agent, "agent", "run");
  const task = readString(input.task, "task", "run");
  const runtime = input.runtime === undefined ? undefined : readRuntime(input.runtime, "runtime", "run");
  const parentRunId = input.parentRunId === undefined ? undefined : input.parentRunId === null ? null : readString(input.parentRunId, "parentRunId", "run");
  const summary = input.summary === undefined ? undefined : readString(input.summary, "summary", "run");

  if (id && parentRunId === id) {
    fail("run", "parentRunId", "parentRunId must not equal id.");
  }

  return {
    ...(id !== undefined ? { id } : {}),
    agent,
    task,
    ...(runtime !== undefined ? { runtime } : {}),
    ...(parentRunId !== undefined ? { parentRunId } : {}),
    ...(summary !== undefined ? { summary } : {}),
  };
}

function parseRunUpdate(input: RunUpdate): RunUpdate {
  if (!isRecord(input)) {
    fail("run update", "$", "Run update must be an object.");
  }

  return {
    ...(input.runtime !== undefined ? { runtime: readRuntime(input.runtime, "runtime", "run update") } : {}),
    ...(input.summary !== undefined ? { summary: readString(input.summary, "summary", "run update") } : {}),
    ...(input.error !== undefined ? { error: readRunError(input.error) } : {}),
  };
}

function parseNextState(value: RunState): RunState {
  if (typeof value !== "string" || !RUN_STATES.includes(value as RunState)) {
    fail("run state", "status", `status must be one of: ${RUN_STATES.join(", ")}.`);
  }
  return value as RunState;
}

function parseRunId(value: string, path: string): string {
  return readString(value, path, "run ID");
}

function readRunError(value: unknown): RunError {
  if (!isRecord(value)) {
    fail("run update", "error", "error must be an object.");
  }

  const code = readString(value.code, "error.code", "run update");
  const message = readString(value.message, "error.message", "run update");
  const retryable = readBoolean(value.retryable, "error.retryable", "run update");
  const details = value.details === undefined ? undefined : readRecord(value.details, "error.details", "run update");

  return { code, message, retryable, ...(details !== undefined ? { details } : {}) };
}

function readString(value: unknown, path: string, kind: string): string {
  if (value === undefined) {
    fail(kind, path, `${path} is required.`);
  }
  if (typeof value !== "string") {
    fail(kind, path, `${path} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    fail(kind, path, `${path} must not be empty.`);
  }
  return trimmed;
}

function readRuntime(value: unknown, path: string, kind: string): ExecutionBackendId {
  if (typeof value !== "string" || !RUN_ENVELOPE_RUNTIMES.includes(value as ExecutionBackendId)) {
    fail(kind, path, `${path} must be one of: ${RUN_ENVELOPE_RUNTIMES.join(", ")}.`);
  }
  return value as ExecutionBackendId;
}

function readBoolean(value: unknown, path: string, kind: string): boolean {
  if (typeof value !== "boolean") {
    fail(kind, path, `${path} must be a boolean.`);
  }
  return value;
}

function readRecord(value: unknown, path: string, kind: string): Record<string, unknown> {
  if (!isRecord(value)) {
    fail(kind, path, `${path} must be an object.`);
  }
  return Object.fromEntries(Object.keys(value).map((key) => [key, value[key]]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function fail(kind: string, path: string, message: string): never {
  throw new RunRegistryValidationError(kind, [{ path, message }]);
}

function formatIssue(issue: ValidationIssue): string {
  return `${issue.path}: ${issue.message}`;
}
