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

const TOP_LEVEL_SPAWN_INPUT_KEYS = new Set(["runId", "agent", "task", "context", "policy", "limits", "output"]);
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
  runId: string;
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
  runtime?: ExecutionBackendId;
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

  const runId = readRequiredString(input, "runId", issues);
  const agent = readAgentDefinition(readOwn(input, "agent"), issues);
  const task = readRequiredString(input, "task", issues);
  const context = readSpawnContext(readOwn(input, "context"), issues);
  const policy = readPermissionPolicy(readOwn(input, "policy"), issues);
  const limits = readSpawnLimits(readOwn(input, "limits"), issues);
  const output = readSpawnOutput(readOwn(input, "output"), issues);

  if (runId && context?.parentRunId === runId) {
    issues.push({ path: "context.parentRunId", message: "context.parentRunId must not equal runId." });
  }

  if (issues.length > 0 || !runId || !agent || !task || !context || !policy || !limits || !output) {
    return fail(issues);
  }

  return { ok: true, value: deepFreeze({ runId, agent, task, context, policy, limits, output }) };
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
  const hasRuntime = hasOwn(input, "runtime");
  const runtime = hasRuntime ? readRequiredEnum(readOwn(input, "runtime"), RUN_ENVELOPE_RUNTIMES, "runtime", issues) : undefined;
  const status = readRequiredEnum(readOwn(input, "status"), RUN_STATES, "status", issues);
  const startedAt = readOptionalIsoDate(readOwn(input, "startedAt"), "startedAt", issues);
  const endedAt = readOptionalIsoDate(readOwn(input, "endedAt"), "endedAt", issues);
  const summary = readOptionalString(readOwn(input, "summary"), "summary", issues);

  if (startedAt && endedAt && Date.parse(endedAt) < Date.parse(startedAt)) {
    issues.push({ path: "endedAt", message: "endedAt must not be earlier than startedAt." });
  }
  if (status === "queued" && startedAt) {
    issues.push({ path: "startedAt", message: "queued run statuses must not include startedAt." });
  }
  const preRuntimeCancelled = status === "cancelled" && !startedAt;
  if (status && status !== "queued" && !preRuntimeCancelled && !hasRuntime) {
    issues.push({ path: "runtime", message: "runtime is required once a run leaves queued." });
  }
  if (status && !isTerminalStatus(status) && endedAt) {
    issues.push({ path: "endedAt", message: `${status} run statuses must not include endedAt.` });
  }
  if (status && isActiveStatus(status) && !startedAt) {
    issues.push({ path: "startedAt", message: `${status} run statuses require startedAt.` });
  }
  if (status && isTerminalStatus(status) && (!startedAt || !endedAt)) {
    if (preRuntimeCancelled && endedAt) {
      // queued -> cancelled may happen before backend/runtime selection.
    } else {
      issues.push({ path: "endedAt", message: `${status} run statuses require startedAt and endedAt.` });
    }
  }

  if (issues.length > 0 || !id || !agent || !status) {
    return fail(issues);
  }

  return {
    ok: true,
    value: deepFreeze({
      id,
      agent,
      ...(runtime !== undefined ? { runtime } : {}),
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
  const result = validateAgentDefinition(cloneOwn(value));
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

  const mode = readRequiredEnum(readOwn(value, "mode"), CONTEXT_INHERITANCE_MODES, "context.mode", issues);
  if (mode === "full") {
    issues.push({ path: "context.mode", message: "context.mode full requires explicit policy approval before backend spawn." });
  }
  const parentRunId = hasOwn(value, "parentRunId") ? readNullableString(readOwn(value, "parentRunId"), "context.parentRunId", issues) : undefined;
  const summary = readOptionalString(readOwn(value, "summary"), "context.summary", issues);
  const files = hasOwn(value, "files") ? readStringList(readOwn(value, "files"), "context.files", issues) : [];
  if (mode === "none" && (summary !== undefined || files.length > 0)) {
    issues.push({ path: "context", message: "context.mode none must not include summary or files." });
  }

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

  const maxRuntimeSec = readPositiveInteger(readOwn(value, "maxRuntimeSec"), "limits.maxRuntimeSec", issues);
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

  const mode = readRequiredEnum(readOwn(value, "mode"), RESULT_MODES, "output.mode", issues);
  const schema = readOutputSchema(readOwn(value, "schema"), "output.schema", issues);
  const artifactPath = readArtifactPath(readOwn(value, "artifactPath"), "output.artifactPath", issues);

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
  for (let index = 0; index < value.length; index += 1) {
    const itemPath = `${path}[${index}]`;
    if (!hasOwn(value, String(index))) {
      issues.push({ path: itemPath, message: `${itemPath} must be an own string.` });
      continue;
    }
    const parsed = readOptionalString(value[index], itemPath, issues);
    if (parsed) {
      strings.push(parsed);
    }
  }
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

function readArtifactPath(value: unknown, path: string, issues: ValidationIssue[]): string | undefined {
  const artifactPath = readOptionalString(value, path, issues);
  if (!artifactPath) {
    return undefined;
  }
  if (
    artifactPath.startsWith("/") ||
    artifactPath.startsWith("\\") ||
    /^[a-zA-Z]:/.test(artifactPath) ||
    artifactPath.split(/[\\/]/).includes("..") ||
    artifactPath.includes("\0")
  ) {
    issues.push({ path, message: `${path} must be a safe relative artifact path.` });
    return undefined;
  }
  return artifactPath;
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
  if (isPlainRecord(value)) {
    const cloned = readJsonObject(value, path, issues);
    return cloned;
  }
  issues.push({ path, message: `${path} must be a string or plain JSON object.` });
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

function isActiveStatus(status: RunState): boolean {
  return status === "starting" || status === "running" || status === "waiting_for_input";
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readOwn(record: Record<string, unknown>, key: string): unknown {
  return hasOwn(record, key) ? record[key] : undefined;
}

function readJsonObject(value: Record<string, unknown>, path: string, issues: ValidationIssue[]): Record<string, unknown> | undefined {
  const entries: Array<[string, unknown]> = [];
  for (const key of Object.keys(value)) {
    const parsed = readJsonValue(value[key], `${path}.${key}`, issues);
    if (parsed !== undefined) {
      entries.push([key, parsed]);
    }
  }
  return issues.some((issue) => issue.path === path || issue.path.startsWith(`${path}.`) || issue.path.startsWith(`${path}[`))
    ? undefined
    : Object.fromEntries(entries);
}

function readJsonValue(value: unknown, path: string, issues: ValidationIssue[]): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return Array.from({ length: value.length }, (_, index) => {
      const itemPath = `${path}[${index}]`;
      if (!hasOwn(value, String(index))) {
        issues.push({ path: itemPath, message: `${itemPath} must be an own JSON value.` });
        return undefined;
      }
      return readJsonValue(value[index], itemPath, issues);
    });
  }
  if (isPlainRecord(value)) {
    return readJsonObject(value, path, issues);
  }
  issues.push({ path, message: `${path} must be JSON-compatible.` });
  return undefined;
}

function cloneOwn(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Array.from({ length: value.length }, (_, index) => (hasOwn(value, String(index)) ? cloneOwn(value[index]) : null));
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(Object.keys(value).map((key) => [key, cloneOwn(value[key])]));
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
