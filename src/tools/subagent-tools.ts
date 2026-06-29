export const SUBAGENT_TOOL_NAMES = Object.freeze([
  "subagent_spawn",
  "subagent_status",
  "subagent_result",
  "subagent_cancel",
] as const);

export type SubagentToolName = (typeof SUBAGENT_TOOL_NAMES)[number];

type TextContent = { type: "text"; text: string };
type AbortSignalLike = { aborted?: boolean };

export interface JsonSchema {
  [keyword: string]: unknown;
}

export interface SubagentToolResultDetails {
  tool: SubagentToolName;
  status: "not_implemented";
  issue: 9;
  reason: string;
}

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

export function registerSubagentTools(pi: PiExtensionApi): void {
  for (const tool of createSubagentTools()) {
    pi.registerTool(tool);
  }
}

export function createSubagentTools(): PiToolDefinition[] {
  return [
    tool("subagent_spawn", "Subagent Spawn", "Start one or more subagent tasks.", spawnParameters),
    tool("subagent_status", "Subagent Status", "List or inspect subagent run status.", statusParameters),
    tool("subagent_result", "Subagent Result", "Retrieve a completed or failed subagent result.", resultParameters),
    tool("subagent_cancel", "Subagent Cancel", "Cancel a subagent run.", cancelParameters),
  ];
}

const taskItem = objectSchema(
  {
    agent: stringSchema("Agent name"),
    task: stringSchema("Task prompt"),
  },
  ["agent", "task"],
);

const spawnParameters = objectSchema({
  agent: stringSchema("Agent name for single-run mode"),
  task: stringSchema("Task prompt for single-run mode"),
  tasks: { type: "array", minItems: 1, items: taskItem },
  mode: enumSchema(["foreground", "background"], "Run mode; defaults to foreground"),
  runtime: enumSchema(["auto", "sdk", "subprocess", "worktree", "mux", "remote"], "Requested runtime backend"),
  context: objectSchema({
    inherit: enumSchema(["none", "summary", "fork", "full"], "Context inheritance mode"),
    files: { type: "array", items: stringSchema("File hint") },
    includeDiff: { type: "boolean", description: "Whether to include the current diff" },
  }),
  limits: objectSchema({
    maxRuntimeSec: { type: "number", exclusiveMinimum: 0, description: "Runtime cap in seconds" },
    maxCostUsd: { type: "number", minimum: 0, description: "Cost cap in USD" },
  }),
  outputSchema: { anyOf: [stringSchema("Output schema name"), { type: "object" }] },
  join: enumSchema(["none", "all", "synthesize"], "Batch join mode"),
});
spawnParameters.anyOf = [{ required: ["agent", "task"] }, { required: ["tasks"] }];

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

function tool(
  name: SubagentToolName,
  label: string,
  action: string,
  parameters: JsonSchema,
): PiToolDefinition {
  return {
    name,
    label,
    description: `Register-only MVP placeholder. ${action} No real subagent execution is performed yet.`,
    promptSnippet: `${action} Real execution arrives after run registry and backend milestones.`,
    promptGuidelines: [`Use ${name} only when the user explicitly asks for subagent run management.`],
    parameters,
    async execute(_toolCallId, _params, signal) {
      if (signal?.aborted) {
        throw new Error("Operation aborted");
      }
      return notImplemented(name);
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

function notImplemented(toolName: SubagentToolName): { content: TextContent[]; details: SubagentToolResultDetails } {
  const reason = "The Pi extension shell is loaded, but run registry and backend execution are not implemented yet.";
  return {
    content: [{ type: "text", text: `${toolName} is registered. ${reason}` }],
    details: { tool: toolName, status: "not_implemented", issue: 9, reason },
  };
}
