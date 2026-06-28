import {
  CONTEXT_INHERITANCE_MODES,
  RUNTIME_BACKENDS,
  type ContextInheritanceMode,
  type RuntimeBackend,
  type ValidationIssue,
  type ValidationResult,
} from "./agent-definition.ts";
import { RUN_STATES, type RunState } from "./run-state.ts";

const TOP_LEVEL_RUN_ENVELOPE_KEYS = new Set([
  "id",
  "parentRunId",
  "agent",
  "runtime",
  "contextMode",
  "status",
  "startedAt",
  "endedAt",
  "summary",
  "findings",
  "artifacts",
  "filesRead",
  "filesChanged",
  "commandsRun",
  "testsRun",
  "cost",
  "confidence",
  "nextActions",
  "error",
]);

const FINDING_KEYS = new Set(["severity", "title", "file", "line", "evidence", "recommendation"]);
const ARTIFACT_KEYS = new Set(["name", "kind", "path", "uri", "bytes", "sha256"]);
const COST_KEYS = new Set(["estimatedUsd", "inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"]);
const ERROR_KEYS = new Set(["code", "message", "retryable", "details"]);

export const FINDING_SEVERITIES = Object.freeze(["info", "low", "medium", "high", "critical"] as const);
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const ARTIFACT_KINDS = Object.freeze([
  "text",
  "json",
  "markdown",
  "patch",
  "log",
  "transcript-summary",
  "html",
  "image-reference",
] as const);
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export interface RunFinding {
  severity: FindingSeverity;
  title: string;
  file?: string;
  line?: number;
  evidence: string;
  recommendation: string;
}

export interface RunArtifactRef {
  name: string;
  kind: ArtifactKind;
  path?: string;
  uri?: string;
  bytes?: number;
  sha256?: string;
}

export interface RunCost {
  estimatedUsd: number | null;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface RunError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

// Standard result contract returned by backends and foreground/result tools.
export interface RunEnvelope {
  id: string;
  parentRunId?: string | null;
  agent: string;
  runtime: RuntimeBackend;
  contextMode: ContextInheritanceMode;
  status: RunState;
  startedAt?: string;
  endedAt?: string;
  summary: string;
  findings: RunFinding[];
  artifacts: RunArtifactRef[];
  filesRead: string[];
  filesChanged: string[];
  commandsRun?: string[];
  testsRun: string[];
  cost: RunCost;
  confidence: number;
  nextActions: string[];
  error?: RunError;
}

export class RunEnvelopeValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid run envelope: ${issues.map(formatIssue).join("; ")}`);
    this.name = "RunEnvelopeValidationError";
    this.issues = issues;
  }
}

export function parseRunEnvelope(input: unknown): RunEnvelope {
  const result = validateRunEnvelope(input);
  if (!result.ok) {
    throw new RunEnvelopeValidationError(result.issues);
  }
  return result.value;
}

export function validateRunEnvelope(input: unknown): ValidationResult<RunEnvelope> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return fail([{ path: "$", message: "Run envelope must be an object." }]);
  }

  rejectUnknownKeys(input, TOP_LEVEL_RUN_ENVELOPE_KEYS, "", issues);

  const id = readRequiredString(input, "id", issues);
  const parentRunId = hasOwn(input, "parentRunId") ? readNullableString(input.parentRunId, "parentRunId", issues) : undefined;
  const agent = readRequiredString(input, "agent", issues);
  const runtime = readRequiredEnum(input.runtime, RUNTIME_BACKENDS, "runtime", issues);
  const contextMode = readRequiredEnum(input.contextMode, CONTEXT_INHERITANCE_MODES, "contextMode", issues);
  const status = readRequiredEnum(input.status, RUN_STATES, "status", issues);
  const startedAt = readOptionalIsoDate(input.startedAt, "startedAt", issues);
  const endedAt = readOptionalIsoDate(input.endedAt, "endedAt", issues);
  const summary = readRequiredString(input, "summary", issues);
  const findings = readFindings(input.findings, issues);
  const artifacts = readArtifacts(input.artifacts, issues);
  const filesRead = readRequiredStringList(input.filesRead, "filesRead", issues);
  const filesChanged = readRequiredStringList(input.filesChanged, "filesChanged", issues);
  const commandsRun = hasOwn(input, "commandsRun") ? readRequiredStringList(input.commandsRun, "commandsRun", issues) : undefined;
  const testsRun = readRequiredStringList(input.testsRun, "testsRun", issues);
  const cost = readCost(input.cost, issues);
  const confidence = readConfidence(input.confidence, issues);
  const nextActions = readRequiredStringList(input.nextActions, "nextActions", issues);
  const error = hasOwn(input, "error") ? readError(input.error, issues) : undefined;

  if (status && isTerminalStatus(status) && (!startedAt || !endedAt)) {
    issues.push({ path: "endedAt", message: `${status} run envelopes require startedAt and endedAt.` });
  }
  if ((status === "failed" || status === "expired") && !error) {
    issues.push({ path: "error", message: `${status} run envelopes require a structured error.` });
  }

  if (issues.length > 0 || !id || !agent || !runtime || !contextMode || !status || !summary || !cost || confidence === undefined) {
    return fail(issues);
  }

  return {
    ok: true,
    value: deepFreeze({
      id,
      ...(parentRunId !== undefined ? { parentRunId } : {}),
      agent,
      runtime,
      contextMode,
      status,
      ...(startedAt !== undefined ? { startedAt } : {}),
      ...(endedAt !== undefined ? { endedAt } : {}),
      summary,
      findings,
      artifacts,
      filesRead,
      filesChanged,
      ...(commandsRun !== undefined ? { commandsRun } : {}),
      testsRun,
      cost,
      confidence,
      nextActions,
      ...(error !== undefined ? { error } : {}),
    }),
  };
}

function readFindings(value: unknown, issues: ValidationIssue[]): RunFinding[] {
  if (!Array.isArray(value)) {
    issues.push({ path: "findings", message: "findings is required and must be an array." });
    return [];
  }

  return value.flatMap((item, index) => {
    const path = `findings[${index}]`;
    if (!isRecord(item)) {
      issues.push({ path, message: "Finding must be an object." });
      return [];
    }
    rejectUnknownKeys(item, FINDING_KEYS, path, issues);

    const severity = readRequiredEnum(item.severity, FINDING_SEVERITIES, `${path}.severity`, issues);
    const title = readRequiredString(item, "title", issues, path);
    const file = readOptionalString(item.file, `${path}.file`, issues);
    const line = readOptionalPositiveInteger(item.line, `${path}.line`, issues);
    const evidence = readRequiredString(item, "evidence", issues, path);
    const recommendation = readRequiredString(item, "recommendation", issues, path);

    return severity && title && evidence && recommendation
      ? [{ severity, title, ...(file ? { file } : {}), ...(line !== undefined ? { line } : {}), evidence, recommendation }]
      : [];
  });
}

function readArtifacts(value: unknown, issues: ValidationIssue[]): RunArtifactRef[] {
  if (!Array.isArray(value)) {
    issues.push({ path: "artifacts", message: "artifacts is required and must be an array." });
    return [];
  }

  return value.flatMap((item, index) => {
    const path = `artifacts[${index}]`;
    if (!isRecord(item)) {
      issues.push({ path, message: "Artifact must be an object." });
      return [];
    }
    rejectUnknownKeys(item, ARTIFACT_KEYS, path, issues);

    const name = readRequiredString(item, "name", issues, path);
    const kind = readRequiredEnum(item.kind, ARTIFACT_KINDS, `${path}.kind`, issues);
    const artifactPath = readOptionalString(item.path, `${path}.path`, issues);
    const uri = readOptionalString(item.uri, `${path}.uri`, issues);
    const bytes = readOptionalNonNegativeInteger(item.bytes, `${path}.bytes`, issues);
    const sha256 = readOptionalString(item.sha256, `${path}.sha256`, issues);

    if (!artifactPath && !uri) {
      issues.push({ path, message: "Artifact requires path or uri." });
    }

    return name && kind && (artifactPath || uri)
      ? [
          {
            name,
            kind,
            ...(artifactPath ? { path: artifactPath } : {}),
            ...(uri ? { uri } : {}),
            ...(bytes !== undefined ? { bytes } : {}),
            ...(sha256 ? { sha256 } : {}),
          },
        ]
      : [];
  });
}

function readCost(value: unknown, issues: ValidationIssue[]): RunCost | undefined {
  if (!isRecord(value)) {
    issues.push({ path: "cost", message: "cost is required and must be an object." });
    return undefined;
  }
  rejectUnknownKeys(value, COST_KEYS, "cost", issues);

  const estimatedUsd = readNullableNonNegativeNumber(value.estimatedUsd, "cost.estimatedUsd", issues);
  const inputTokens = readOptionalNonNegativeInteger(value.inputTokens, "cost.inputTokens", issues);
  const outputTokens = readOptionalNonNegativeInteger(value.outputTokens, "cost.outputTokens", issues);
  const cacheReadTokens = readOptionalNonNegativeInteger(value.cacheReadTokens, "cost.cacheReadTokens", issues);
  const cacheWriteTokens = readOptionalNonNegativeInteger(value.cacheWriteTokens, "cost.cacheWriteTokens", issues);

  return estimatedUsd !== undefined
    ? {
        estimatedUsd,
        ...(inputTokens !== undefined ? { inputTokens } : {}),
        ...(outputTokens !== undefined ? { outputTokens } : {}),
        ...(cacheReadTokens !== undefined ? { cacheReadTokens } : {}),
        ...(cacheWriteTokens !== undefined ? { cacheWriteTokens } : {}),
      }
    : undefined;
}

function readError(value: unknown, issues: ValidationIssue[]): RunError | undefined {
  if (!isRecord(value)) {
    issues.push({ path: "error", message: "error must be an object." });
    return undefined;
  }
  rejectUnknownKeys(value, ERROR_KEYS, "error", issues);

  const code = readRequiredString(value, "code", issues, "error");
  const message = readRequiredString(value, "message", issues, "error");
  const retryable = readRequiredBoolean(value.retryable, "error.retryable", issues);
  const details = hasOwn(value, "details") ? readOptionalRecord(value.details, "error.details", issues) : undefined;

  return code && message && retryable !== undefined
    ? { code, message, retryable, ...(details !== undefined ? { details } : {}) }
    : undefined;
}

function readRequiredString(
  input: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
  parentPath = "",
): string | undefined {
  const path = parentPath ? `${parentPath}.${key}` : key;
  if (!hasOwn(input, key)) {
    issues.push({ path, message: `${path} is required.` });
    return undefined;
  }
  return readOptionalString(input[key], path, issues);
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

function readRequiredStringList(value: unknown, path: string, issues: ValidationIssue[]): string[] {
  if (!Array.isArray(value)) {
    issues.push({ path, message: `${path} is required and must be an array of strings.` });
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
  return readOptionalEnum(value, allowed, path, issues);
}

function readOptionalEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
  issues: ValidationIssue[],
): T[number] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !allowed.includes(value as T[number])) {
    issues.push({ path, message: `${path} must be one of: ${allowed.join(", ")}.` });
    return undefined;
  }
  return value;
}

function readRequiredBoolean(value: unknown, path: string, issues: ValidationIssue[]): boolean | undefined {
  if (value === undefined) {
    issues.push({ path, message: `${path} is required.` });
    return undefined;
  }
  if (typeof value !== "boolean") {
    issues.push({ path, message: `${path} must be a boolean.` });
    return undefined;
  }
  return value;
}

function readConfidence(value: unknown, issues: ValidationIssue[]): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    issues.push({ path: "confidence", message: "confidence is required and must be between 0 and 1." });
    return undefined;
  }
  return value;
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

function readNullableNonNegativeNumber(value: unknown, path: string, issues: ValidationIssue[]): number | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    issues.push({ path, message: `${path} is required and must be null or a non-negative number.` });
    return undefined;
  }
  return value;
}

function readOptionalNonNegativeInteger(value: unknown, path: string, issues: ValidationIssue[]): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    issues.push({ path, message: `${path} must be a non-negative integer.` });
    return undefined;
  }
  return value;
}

function readOptionalPositiveInteger(value: unknown, path: string, issues: ValidationIssue[]): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    issues.push({ path, message: `${path} must be a positive integer.` });
    return undefined;
  }
  return value;
}

function readOptionalRecord(value: unknown, path: string, issues: ValidationIssue[]): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    issues.push({ path, message: `${path} must be an object.` });
    return undefined;
  }
  return value;
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
