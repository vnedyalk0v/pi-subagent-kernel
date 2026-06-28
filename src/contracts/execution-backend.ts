import {
  CONTEXT_INHERITANCE_MODES,
  RESULT_MODES,
  validateAgentDefinition,
  type AgentDefinition,
  type ContextInheritanceMode,
  type ResultMode,
  type ValidationIssue,
  type ValidationResult,
} from "./agent-definition.ts";
import { validatePermissionPolicy, type PermissionPolicy } from "./permission-policy.ts";
import { RUN_ENVELOPE_RUNTIMES, type RunEnvelope, type RunEnvelopeRuntime } from "./run-envelope.ts";
import { RUN_STATES, type RunState } from "./run-state.ts";

const TOP_LEVEL_SPAWN_INPUT_KEYS = new Set(["agent", "task", "context", "policy", "limits", "output"]);
const SPAWN_CONTEXT_KEYS = new Set(["mode", "parentRunId", "summary", "files"]);
const SPAWN_LIMITS_KEYS = new Set(["maxRuntimeSec"]);
const SPAWN_OUTPUT_KEYS = new Set(["mode", "schema", "artifactPath"]);
const RUN_STATUS_KEYS = new Set(["id", "agent", "runtime", "status", "startedAt", "endedAt", "summary"]);

export type ExecutionBackendId = RunEnvelopeRuntime;

export interface SpawnContext {
  mode: ContextInheritanceMode;
  parentRunId?: string | null;
  summary?: string;
  files: string[];
}

export interface SpawnLimits {
  maxRuntimeSec: number;
}

export interface SpawnOutputRequirements {
  mode: ResultMode;
  schema?: string | Record<string, unknown>;
  artifactPath?: string;
}

export interface SpawnInput {
  agent: AgentDefinition;
  task: string;
  context: SpawnContext;
  policy: PermissionPolicy;
  limits: SpawnLimits;
  output: SpawnOutputRequirements;
}

export interface RunStatus {
  id: string;
  agent: string;
  runtime: ExecutionBackendId;
  status: RunState;
  startedAt?: string;
  endedAt?: string;
  summary?: string;
}

// Lifecycle contract shared by SDK, subprocess, worktree, mux, and test backends.
export interface ExecutionBackend {
  readonly id: ExecutionBackendId;
  spawn(input: SpawnInput): Promise<RunStatus>;
  status(runId: string): Promise<RunStatus>;
  result(runId: string): Promise<RunEnvelope>;
  cancel(runId: string, reason?: string): Promise<RunStatus>;
}

export class ExecutionBackendValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(kind: string, issues: ValidationIssue[]) {
    super(`Invalid ${kind}: ${issues.map(formatIssue).join("; ")}`);
    this.name = "ExecutionBackendValidationError";
    this.issues = issues;
  }
}

export function parseSpawnInput(input: unknown): SpawnInput {
  const result = validateSpawnInput(input);
  if (!result.ok) {
    throw new ExecutionBackendValidationError("spawn input", result.issues);
  }
  return result.value;
}

export function validateSpawnInput(input: unknown): ValidationResult<SpawnInput> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return fail([{ path: "$", message: "Spawn input must be an object." }]);
  }

  rejectUnknownKeys(input, TOP_LEVEL_SPAWN_INPUT_KEYS, "", issues);

  const agent = readAgentDefinition(input.agent, issues);
  const task = readRequiredString(input, "task", issues);
  const context = readSpawnContext(input.context, issues);
  const policy = readPermissionPolicy(input.policy, issues);
  const limits = readSpawnLimits(input.limits, issues);
  const output = readSpawnOutput(input.output, issues);

  if (issues.length > 0 || !agent || !task || !context || !policy || !limits || !output) {
    return fail(issues);
  }

  return { ok: true, value: deepFreeze({ agent, task, context, policy, limits, output }) };
}

export function parseRunStatus(input: unknown): RunStatus {
  const result = validateRunStatus(input);
  if (!result.ok) {
    throw new ExecutionBackendValidationError("run status", result.issues);
  }
  return result.value;
}

export function validateRunStatus(input: unknown): ValidationResult<RunStatus> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return fail([{ path: "$", message: "Run status must be an object." }]);
  }

  rejectUnknownKeys(input, RUN_STATUS_KEYS, "", issues);

  const id = readRequiredString(input, "id", issues);
  const agent = readRequiredString(input, "agent", issues);
  const runtime = readRequiredEnum(input.runtime, RUN_ENVELOPE_RUNTIMES, "runtime", issues);
  const status = readRequiredEnum(input.status, RUN_STATES, "status", issues);
  const startedAt = readOptionalIsoDate(input.startedAt, "startedAt", issues);
  const endedAt = readOptionalIsoDate(input.endedAt, "endedAt", issues);
  const summary = readOptionalString(input.summary, "summary", issues);

  if (startedAt && endedAt && Date.parse(endedAt) < Date.parse(startedAt)) {
    issues.push({ path: "endedAt", message: "endedAt must not be earlier than startedAt." });
  }
  if (status && isTerminalStatus(status) && (!startedAt || !endedAt)) {
    issues.push({ path: "endedAt", message: `${status} run statuses require startedAt and endedAt.` });
  }

  if (issues.length > 0 || !id || !agent || !runtime || !status) {
    return fail(issues);
  }

  return {
    ok: true,
    value: deepFreeze({
      id,
      agent,
      runtime,
      status,
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(endedAt !== undefined ? { endedAt } : {}),
      ...(summary !== undefined ? { summary } : {}),
    }),
  };
}

export function runStatusFromEnvelope(envelope: RunEnvelope): RunStatus {
  return parseRunStatus({
    id: envelope.id,
    agent: envelope.agent,
    runtime: envelope.runtime,
    status: envelope.status,
    ...(envelope.startedAt !== undefined ? { startedAt: envelope.startedAt } : {}),
    ...(envelope.endedAt !== undefined ? { endedAt: envelope.endedAt } : {}),
    ...(envelope.summary ? { summary: envelope.summary } : {}),
  });
}

function readAgentDefinition(value: unknown, issues: ValidationIssue[]): AgentDefinition | undefined {
  if (value === undefined) {
    issues.push({ path: "agent", message: "agent is required." });
    return undefined;
  }
  const result = validateAgentDefinition(value);
  if (!result.ok) {
    issues.push(...prefixIssues("agent", result.issues));
    return undefined;
  }
  return result.value;
}

function readPermissionPolicy(value: unknown, issues: ValidationIssue[]): PermissionPolicy | undefined {
  if (value === undefined) {
    issues.push({ path: "policy", message: "policy is required." });
    return undefined;
  }
  const result = validatePermissionPolicy(value);
  if (!result.ok) {
    issues.push(...prefixIssues("policy", result.issues));
    return undefined;
  }
  return result.value;
}

function readSpawnContext(value: unknown, issues: ValidationIssue[]): SpawnContext | undefined {
  if (value === undefined) {
    issues.push({ path: "context", message: "context is required." });
    return undefined;
  }
  if (!isRecord(value)) {
    issues.push({ path: "context", message: "context must be an object." });
    return undefined;
  }

  rejectUnknownKeys(value, SPAWN_CONTEXT_KEYS, "context", issues);

  const mode = readRequiredEnum(value.mode, CONTEXT_INHERITANCE_MODES, "context.mode", issues);
  if (mode === "full") {
    issues.push({ path: "context.mode", message: "context.mode full requires explicit policy approval before backend spawn." });
  }
  const parentRunId = hasOwn(value, "parentRunId") ? readNullableString(value.parentRunId, "context.parentRunId", issues) : undefined;
  const summary = readOptionalString(value.summary, "context.summary", issues);
  const files = hasOwn(value, "files") ? readStringList(value.files, "context.files", issues) : [];

  return mode
    ? {
        mode,
        ...(parentRunId !== undefined ? { parentRunId } : {}),
        ...(summary !== undefined ? { summary } : {}),
        files,
      }
    : undefined;
}

function readSpawnLimits(value: unknown, issues: ValidationIssue[]): SpawnLimits | undefined {
  if (value === undefined) {
    issues.push({ path: "limits", message: "limits is required." });
    return undefined;
  }
  if (!isRecord(value)) {
    issues.push({ path: "limits", message: "limits must be an object." });
    return undefined;
  }

  rejectUnknownKeys(value, SPAWN_LIMITS_KEYS, "limits", issues);

  const maxRuntimeSec = readPositiveInteger(value.maxRuntimeSec, "limits.maxRuntimeSec", issues);
  return maxRuntimeSec !== undefined ? { maxRuntimeSec } : undefined;
}

function readSpawnOutput(value: unknown, issues: ValidationIssue[]): SpawnOutputRequirements | undefined {
  if (value === undefined) {
    issues.push({ path: "output", message: "output is required." });
    return undefined;
  }
  if (!isRecord(value)) {
    issues.push({ path: "output", message: "output must be an object." });
    return undefined;
  }

  rejectUnknownKeys(value, SPAWN_OUTPUT_KEYS, "output", issues);

  const mode = readRequiredEnum(value.mode, RESULT_MODES, "output.mode", issues);
  const schema = readOutputSchema(value.schema, "output.schema", issues);
  const artifactPath = readOptionalString(value.artifactPath, "output.artifactPath", issues);

  return mode
    ? {
        mode,
        ...(schema !== undefined ? { schema } : {}),
        ...(artifactPath !== undefined ? { artifactPath } : {}),
      }
    : undefined;
}

function readRequiredString(input: Record<string, unknown>, key: string, issues: ValidationIssue[]): string | undefined {
  if (!hasOwn(input, key)) {
    issues.push({ path: key, message: `${key} is required.` });
    return undefined;
  }
  return readOptionalString(input[key], key, issues);
}

function readOptionalString(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push({ path, message: `${path} must be a string.` });
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    issues.push({ path, message: `${path} must not be empty.` });
    return undefined;
  }
  return trimmed;
}

function readNullableString(value: unknown, path: string, issues: ValidationIssue[]): string | null | undefined {
  return value === null ? null : readOptionalString(value, path, issues);
}

function readStringList(value: unknown, path: string, issues: ValidationIssue[]): string[] {
  if (!Array.isArray(value)) {
    issues.push({ path, message: `${path} must be an array of strings.` });
    return [];
  }

  const strings: string[] = [];
  value.forEach((item, index) => {
    const parsed = readOptionalString(item, `${path}[${index}]`, issues);
    if (parsed) {
      strings.push(parsed);
    }
  });
  return strings;
}

function readRequiredEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
  issues: ValidationIssue[],
): T[number] | undefined {
  if (value === undefined) {
    issues.push({ path, message: `${path} is required.` });
    return undefined;
  }
  if (typeof value !== "string" || !allowed.includes(value as T[number])) {
    issues.push({ path, message: `${path} must be one of: ${allowed.join(", ")}.` });
    return undefined;
  }
  return value;
}

function readPositiveInteger(value: unknown, path: string, issues: ValidationIssue[]): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    issues.push({ path, message: `${path} is required and must be a positive integer.` });
    return undefined;
  }
  return value;
}

function readOutputSchema(value: unknown, path: string, issues: ValidationIssue[]): string | Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      issues.push({ path, message: `${path} must not be empty.` });
      return undefined;
    }
    return trimmed;
  }
  if (isRecord(value)) {
    return value;
  }
  issues.push({ path, message: `${path} must be a string or object.` });
  return undefined;
}

function readOptionalIsoDate(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  const parsed = readOptionalString(value, path, issues);
  if (!parsed) {
    return undefined;
  }
  const time = Date.parse(parsed);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed) || Number.isNaN(time) || new Date(time).toISOString() !== parsed) {
    issues.push({ path, message: `${path} must be an ISO timestamp like 2026-06-26T10:00:00.000Z.` });
    return undefined;
  }
  return parsed;
}

function isTerminalStatus(status: RunState): boolean {
  return status === "completed" || status === "failed" || status === "cancelled" || status === "expired";
}

function prefixIssues(prefix: string, issues: ValidationIssue[]): ValidationIssue[] {
  return issues.map((issue) => ({ ...issue, path: issue.path === "$" ? prefix : `${prefix}.${issue.path}` }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      issues.push({ path: path ? `${path}.${key}` : key, message: `Unknown field "${key}".` });
    }
  }
}

function fail<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

function formatIssue(issue: ValidationIssue): string {
  return `${issue.path}: ${issue.message}`;
}
