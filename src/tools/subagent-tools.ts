import { randomUUID } from "node:crypto";

import {
  parsePermissionPolicy,
  parseRunEnvelope,
  parseSpawnInput,
  RUN_ENVELOPE_RUNTIMES,
  type ExecutionBackendId,
  type PermissionPolicy,
  type RunEnvelope,
  type RunStatus,
  type SpawnInput,
} from "../contracts/index.ts";
import { AgentRegistry, registerBuiltInAgents, RunRegistry } from "../registry/index.ts";

export const SUBAGENT_TOOL_NAMES = Object.freeze([
  "subagent_spawn",
  "subagent_status",
  "subagent_result",
  "subagent_cancel",
] as const);

export type SubagentToolName = (typeof SUBAGENT_TOOL_NAMES)[number];

type TextContent = { type: "text"; text: string };
type AbortSignalLike = { aborted?: boolean };
type SpawnMode = "foreground" | "background";
type RequestedRuntime = ExecutionBackendId | "auto";

export interface JsonSchema {
  [keyword: string]: unknown;
}

export interface NotImplementedToolResultDetails {
  tool: Exclude<SubagentToolName, "subagent_spawn">;
  status: "not_implemented";
  issue: 15 | 16 | 17;
  reason: string;
}

export interface SpawnToolResultDetails {
  tool: "subagent_spawn";
  status: RunStatus["status"];
  mode: SpawnMode;
  id: string;
  run: RunStatus;
  policy: PermissionPolicy;
  limits: { maxRuntimeSec: number; maxCostUsd?: number };
  mock: true;
  message: string;
  result?: RunEnvelope;
}

export type SubagentToolResultDetails = NotImplementedToolResultDetails | SpawnToolResultDetails;

export interface PiToolDefinition {
  name: SubagentToolName;
  label: string;
  description: string;
  promptSnippet: string;
  promptGuidelines: string[];
  parameters: JsonSchema;
  execute(
    toolCallId: string,
    params: unknown,
    signal?: AbortSignalLike,
  ): Promise<{ content: TextContent[]; details: SubagentToolResultDetails }>;
}

export interface PiExtensionApi {
  registerTool(tool: PiToolDefinition): void;
}

export interface SubagentToolServices {
  agents: AgentRegistry;
  runs: RunRegistry;
}

export function createSubagentToolServices(): SubagentToolServices {
  const agents = new AgentRegistry();
  registerBuiltInAgents(agents);
  return { agents, runs: new RunRegistry() };
}

export function registerSubagentTools(pi: PiExtensionApi, services: SubagentToolServices = createSubagentToolServices()): void {
  for (const tool of createSubagentTools(services)) {
    pi.registerTool(tool);
  }
}

export function createSubagentTools(services: SubagentToolServices = createSubagentToolServices()): PiToolDefinition[] {
  return [
    spawnTool(services),
    placeholderTool("subagent_status", "Subagent Status", "List or inspect subagent run status.", statusParameters, 15),
    placeholderTool("subagent_result", "Subagent Result", "Retrieve a completed or failed subagent result.", resultParameters, 16),
    placeholderTool("subagent_cancel", "Subagent Cancel", "Cancel a subagent run.", cancelParameters, 17),
  ];
}

const spawnParameters = objectSchema(
  {
    agent: stringSchema("Agent name"),
    task: stringSchema("Task prompt"),
    mode: enumSchema(["foreground", "background"], "Run mode; defaults to foreground"),
    runtime: enumSchema(["auto", "sdk", "subprocess", "worktree", "mux", "remote"], "Requested runtime backend"),
    context: objectSchema({
      inherit: enumSchema(["none", "summary", "fork", "full"], "Context inheritance mode"),
      files: { type: "array", items: stringSchema("File hint") },
      includeDiff: { type: "boolean", description: "Whether to include the current diff" },
    }),
    limits: objectSchema({
      maxRuntimeSec: { type: "integer", exclusiveMinimum: 0, description: "Runtime cap in seconds" },
      maxCostUsd: { type: "number", minimum: 0, description: "Cost cap in USD" },
    }),
    outputSchema: { anyOf: [stringSchema("Output schema name"), { type: "object" }] },
  },
  ["agent", "task"],
);

const statusParameters = objectSchema({
  id: stringSchema("Run ID to inspect; omit to list active and recent runs"),
  includeRecentEvents: { type: "boolean", description: "Include recent lifecycle events" },
});

const resultParameters = objectSchema(
  {
    id: stringSchema("Run ID"),
    includeArtifacts: { type: "boolean", description: "Include artifact references" },
    includeEvents: { type: "boolean", description: "Include lifecycle events" },
  },
  ["id"],
);

const cancelParameters = objectSchema(
  {
    id: stringSchema("Run ID"),
    reason: stringSchema("Human-readable cancellation reason"),
  },
  ["id"],
);

function spawnTool(services: SubagentToolServices): PiToolDefinition {
  return {
    name: "subagent_spawn",
    label: "Subagent Spawn",
    description: "Start a subagent task using the MVP mock backend. No real child process is executed yet.",
    promptSnippet: "Start one mock subagent run and return a structured result or run ID.",
    promptGuidelines: ["Use subagent_spawn only when the user explicitly asks for subagent delegation."],
    parameters: spawnParameters,
    async execute(_toolCallId, params, signal) {
      if (signal?.aborted) {
        throw new Error("Operation aborted");
      }

      const request = parseSpawnToolInput(params);
      const agent = services.agents.get(request.agent);
      if (!agent) {
        throw new SubagentToolValidationError(`Unknown agent "${request.agent}". Available agents: ${services.agents.list().map((item) => item.name).join(", ")}.`);
      }

      const runtime = resolveRuntime(request.runtime, agent.runtime);
      const policy = parsePermissionPolicy({});
      const maxRuntimeCap = agent.maxRuntimeSec ?? 1800;
      const requestedCost = request.limits?.maxCostUsd ?? agent.maxCostUsd;
      const limits = {
        maxRuntimeSec: Math.min(request.limits?.maxRuntimeSec ?? maxRuntimeCap, maxRuntimeCap),
        ...(requestedCost !== undefined
          ? { maxCostUsd: agent.maxCostUsd !== undefined ? Math.min(requestedCost, agent.maxCostUsd) : requestedCost }
          : {}),
      };
      const contextMode = request.context?.inherit ?? agent.inheritContext;
      const runId = `run_${randomUUID()}`;
      const spawnInput = parseSpawnInput({
        runId,
        agent,
        task: request.task,
        context: {
          mode: contextMode,
          parentRunId: null,
          ...(request.context?.includeDiff ? { summary: "Mock backend noted includeDiff=true; no diff artifact is produced yet." } : {}),
          files: request.context?.files ?? [],
        },
        policy,
        limits: {
          maxRuntimeSec: limits.maxRuntimeSec,
        },
        output: {
          mode: agent.resultMode ?? "json",
          ...(request.outputSchema !== undefined ? { schema: request.outputSchema } : agent.outputSchema !== undefined ? { schema: agent.outputSchema } : {}),
        },
      });
      const run = services.runs.create({ id: runId, agent: agent.name, task: request.task, runtime });
      const started = services.runs.updateState(run.id, "starting", { runtime, summary: "Starting mock backend." });
      services.runs.updateState(run.id, "running", { summary: `Mock ${agent.name} running.` });
      const result = runMockBackend(spawnInput, runtime, started.startedAt ?? new Date().toISOString());
      services.runs.storeResult(result);
      const status = services.runs.status(run.id);

      return request.mode === "foreground"
        ? {
            content: [{ type: "text", text: result.summary }],
            details: {
              tool: "subagent_spawn",
              status: result.status,
              mode: "foreground",
              id: run.id,
              run: status,
              policy,
              limits,
              mock: true,
              message: "Mock backend completed synchronously. No real child process was executed.",
              result,
            },
          }
        : {
            content: [{ type: "text", text: `Started mock ${agent.name} subagent as ${run.id}. Use subagent_status or subagent_result after those tools are implemented.` }],
            details: {
              tool: "subagent_spawn",
              status: status.status,
              mode: "background",
              id: run.id,
              run: status,
              policy,
              limits,
              mock: true,
              message: "Mock backend completed synchronously; returning only the run ID for background mode.",
            },
          };
    },
  };
}

function runMockBackend(input: SpawnInput, runtime: ExecutionBackendId, startedAt: string): RunEnvelope {
  const endedAt = new Date(Date.parse(startedAt) + 1).toISOString();
  return parseRunEnvelope({
    id: input.runId,
    ...(input.context.parentRunId !== undefined ? { parentRunId: input.context.parentRunId } : {}),
    agent: input.agent.name,
    runtime,
    contextMode: input.context.mode,
    status: "completed",
    startedAt,
    endedAt,
    summary: `Mock ${input.agent.name} completed: ${input.task}`,
    findings: [],
    artifacts: [],
    filesRead: input.context.files,
    filesChanged: [],
    testsRun: [],
    cost: { estimatedUsd: null },
    confidence: 1,
    nextActions: ["Replace the mock backend with real execution before relying on subagent output."],
  });
}

function placeholderTool(
  name: Exclude<SubagentToolName, "subagent_spawn">,
  label: string,
  action: string,
  parameters: JsonSchema,
  issue: 15 | 16 | 17,
): PiToolDefinition {
  return {
    name,
    label,
    description: `Register-only MVP placeholder. ${action} Implementation arrives in issue #${issue}.`,
    promptSnippet: `${action} Implementation arrives in issue #${issue}.`,
    promptGuidelines: [`Use ${name} only when the user explicitly asks for subagent run management.`],
    parameters,
    async execute(_toolCallId, _params, signal) {
      if (signal?.aborted) {
        throw new Error("Operation aborted");
      }
      return notImplemented(name, issue);
    },
  };
}

function objectSchema(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    ...(required.length > 0 ? { required } : {}),
    properties,
  };
}

function stringSchema(description: string): JsonSchema {
  return { type: "string", minLength: 1, description };
}

function enumSchema(values: readonly string[], description: string): JsonSchema {
  return { type: "string", enum: values, description };
}

function notImplemented(
  toolName: Exclude<SubagentToolName, "subagent_spawn">,
  issue: 15 | 16 | 17,
): { content: TextContent[]; details: NotImplementedToolResultDetails } {
  const reason = `This tool is registered, but implementation is tracked by issue #${issue}.`;
  return {
    content: [{ type: "text", text: `${toolName} is registered. ${reason}` }],
    details: { tool: toolName, status: "not_implemented", issue, reason },
  };
}

interface SpawnToolInput {
  agent: string;
  task: string;
  mode: SpawnMode;
  runtime: RequestedRuntime;
  context?: {
    inherit?: "none" | "summary" | "fork" | "full";
    files?: string[];
    includeDiff?: boolean;
  };
  limits?: {
    maxRuntimeSec?: number;
    maxCostUsd?: number;
  };
  outputSchema?: string | Record<string, unknown>;
}

const SPAWN_KEYS = new Set(["agent", "task", "mode", "runtime", "context", "limits", "outputSchema"]);
const CONTEXT_KEYS = new Set(["inherit", "files", "includeDiff"]);
const LIMIT_KEYS = new Set(["maxRuntimeSec", "maxCostUsd"]);

export class SubagentToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubagentToolValidationError";
  }
}

function parseSpawnToolInput(input: unknown): SpawnToolInput {
  const value = readRecord(input, "$", "Spawn input must be an object.");
  rejectUnknown(value, SPAWN_KEYS, "");

  return {
    agent: readString(own(value, "agent"), "agent"),
    task: readString(own(value, "task"), "task"),
    mode: readEnum(own(value, "mode"), ["foreground", "background"] as const, "mode") ?? "foreground",
    runtime: readEnum(own(value, "runtime"), ["auto", ...RUN_ENVELOPE_RUNTIMES] as const, "runtime") ?? "auto",
    ...(own(value, "context") !== undefined ? { context: readContext(own(value, "context")) } : {}),
    ...(own(value, "limits") !== undefined ? { limits: readLimits(own(value, "limits")) } : {}),
    ...(own(value, "outputSchema") !== undefined ? { outputSchema: readOutputSchema(own(value, "outputSchema"), "outputSchema") } : {}),
  };
}

function readContext(input: unknown): NonNullable<SpawnToolInput["context"]> {
  const value = readRecord(input, "context", "context must be an object.");
  rejectUnknown(value, CONTEXT_KEYS, "context");

  const inherit = own(value, "inherit");
  return {
    ...(inherit !== undefined ? { inherit: readRequiredEnum(inherit, ["none", "summary", "fork", "full"] as const, "context.inherit") } : {}),
    ...(own(value, "files") !== undefined ? { files: readStringArray(own(value, "files"), "context.files") } : {}),
    ...(own(value, "includeDiff") !== undefined ? { includeDiff: readBoolean(own(value, "includeDiff"), "context.includeDiff") } : {}),
  };
}

function readLimits(input: unknown): NonNullable<SpawnToolInput["limits"]> {
  const value = readRecord(input, "limits", "limits must be an object.");
  rejectUnknown(value, LIMIT_KEYS, "limits");

  return {
    ...(own(value, "maxRuntimeSec") !== undefined ? { maxRuntimeSec: readPositiveInteger(own(value, "maxRuntimeSec"), "limits.maxRuntimeSec") } : {}),
    ...(own(value, "maxCostUsd") !== undefined ? { maxCostUsd: readNonNegativeNumber(own(value, "maxCostUsd"), "limits.maxCostUsd") } : {}),
  };
}

function resolveRuntime(requested: RequestedRuntime, agentRuntime: RequestedRuntime): ExecutionBackendId {
  const resolved = requested === "auto" ? agentRuntime : requested;
  return resolved === "auto" ? "sdk" : resolved;
}

function readOutputSchema(value: unknown, path: string): string | Record<string, unknown> {
  if (typeof value === "string") {
    return readString(value, path);
  }
  return { ...readRecord(value, path, `${path} must be a string or object.`) };
}

function readRecord(value: unknown, path: string, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SubagentToolValidationError(`${path}: ${message}`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new SubagentToolValidationError(`${path}: ${path} is required and must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new SubagentToolValidationError(`${path}: ${path} must not be empty.`);
  }
  return trimmed;
}

function readStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new SubagentToolValidationError(`${path}: ${path} must be an array of strings.`);
  }
  return value.map((item, index) => readString(item, `${path}[${index}]`));
}

function readEnum<const T extends readonly string[]>(value: unknown, allowed: T, path: string): T[number] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !allowed.includes(value as T[number])) {
    throw new SubagentToolValidationError(`${path}: ${path} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T[number];
}

function readRequiredEnum<const T extends readonly string[]>(value: unknown, allowed: T, path: string): T[number] {
  const parsed = readEnum(value, allowed, path);
  if (parsed === undefined) {
    throw new SubagentToolValidationError(`${path}: ${path} is required.`);
  }
  return parsed;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new SubagentToolValidationError(`${path}: ${path} must be a boolean.`);
  }
  return value;
}

function readPositiveInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new SubagentToolValidationError(`${path}: ${path} must be a positive integer.`);
  }
  return value;
}

function readNonNegativeNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new SubagentToolValidationError(`${path}: ${path} must be a non-negative number.`);
  }
  return value;
}

function rejectUnknown(record: Record<string, unknown>, allowed: ReadonlySet<string>, prefix: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      const path = prefix ? `${prefix}.${key}` : key;
      throw new SubagentToolValidationError(`${path}: Unknown field "${path}".`);
    }
  }
}

function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}
