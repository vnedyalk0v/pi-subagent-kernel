export const AGENT_NAME_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;

export const RUNTIME_BACKENDS = ["sdk", "subprocess", "worktree", "mux", "remote", "auto"] as const;
export type RuntimeBackend = (typeof RUNTIME_BACKENDS)[number];

export const CONTEXT_INHERITANCE_MODES = ["none", "summary", "fork", "full"] as const;
export type ContextInheritanceMode = (typeof CONTEXT_INHERITANCE_MODES)[number];

export const FILESYSTEM_POLICIES = [
  "none",
  "read-only",
  "workspace-write",
  "worktree-write",
  "unrestricted",
] as const;
export type FilesystemPolicy = (typeof FILESYSTEM_POLICIES)[number];

export const NETWORK_POLICIES = ["none", "docs-only", "ask", "allow"] as const;
export type NetworkPolicy = (typeof NETWORK_POLICIES)[number];

export const SHELL_POLICIES = ["none", "test-only", "ask", "allow"] as const;
export type ShellPolicy = (typeof SHELL_POLICIES)[number];

export const CHILD_EXTENSION_POLICIES = ["deny-by-default", "allow"] as const;
export type ChildExtensionPolicy = (typeof CHILD_EXTENSION_POLICIES)[number];

export interface AgentSandbox {
  filesystem: FilesystemPolicy;
  network: NetworkPolicy;
  shell: ShellPolicy;
  mcpServers: string[];
  childExtensions: ChildExtensionPolicy;
}

export interface AgentDefinition {
  name: string;
  description: string;
  instructions: string;
  runtime: RuntimeBackend;
  tools: string[];
  disallowedTools: string[];
  skills: string[];
  model: string;
  thinking?: string;
  reasoning?: string;
  maxTurns?: number;
  maxRuntimeSec?: number;
  maxCostUsd?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxDepth?: number;
  inheritContext: ContextInheritanceMode;
  nestedSubagents: boolean;
  sandbox: AgentSandbox;
  outputSchema?: string | Record<string, unknown>;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

// Safe-by-default values from docs/07-context-safety-permissions.md.
export const AGENT_DEFINITION_DEFAULTS = Object.freeze({
  runtime: "auto" satisfies RuntimeBackend,
  tools: Object.freeze([]) as readonly string[],
  disallowedTools: Object.freeze([]) as readonly string[],
  skills: Object.freeze([]) as readonly string[],
  model: "inherit",
  inheritContext: "summary" satisfies ContextInheritanceMode,
  nestedSubagents: false,
  sandbox: Object.freeze({
    filesystem: "read-only" satisfies FilesystemPolicy,
    network: "none" satisfies NetworkPolicy,
    shell: "none" satisfies ShellPolicy,
    mcpServers: Object.freeze([]) as readonly string[],
    childExtensions: "deny-by-default" satisfies ChildExtensionPolicy,
  }),
});

const TOP_LEVEL_AGENT_KEYS = new Set([
  "name",
  "description",
  "instructions",
  "body",
  "runtime",
  "tools",
  "disallowedTools",
  "skills",
  "model",
  "thinking",
  "reasoning",
  "maxTurns",
  "maxRuntimeSec",
  "maxCostUsd",
  "maxInputTokens",
  "maxOutputTokens",
  "maxDepth",
  "inheritContext",
  "nestedSubagents",
  "sandbox",
  "permissions",
  "mcpServers",
  "context",
  "limits",
  "outputSchema",
]);

const LIMIT_KEYS = new Set(["maxTurns", "maxRuntimeSec", "maxCostUsd", "maxInputTokens", "maxOutputTokens", "maxDepth", "nestedSubagents"]);
const CONTEXT_KEYS = new Set(["inherit"]);
const SANDBOX_KEYS = new Set(["filesystem", "network", "shell", "mcp", "mcpServers", "childExtensions"]);

export class AgentDefinitionValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid agent definition: ${issues.map(formatIssue).join("; ")}`);
    this.name = "AgentDefinitionValidationError";
    this.issues = issues;
  }
}

export function parseAgentDefinition(input: unknown): AgentDefinition {
  const result = validateAgentDefinition(input);
  if (!result.ok) {
    throw new AgentDefinitionValidationError(result.issues);
  }
  return result.value;
}

export function validateAgentDefinition(input: unknown): ValidationResult<AgentDefinition> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return fail([{ path: "$", message: "Agent definition must be an object." }]);
  }

  rejectUnknownKeys(input, TOP_LEVEL_AGENT_KEYS, "", issues);

  const name = readRequiredString(input, "name", issues);
  if (name && !AGENT_NAME_PATTERN.test(name)) {
    issues.push({
      path: "name",
      message: "Name must match /^[a-z][a-z0-9_-]{1,63}$/.",
    });
  }

  const description = readRequiredString(input, "description", issues);
  const instructions = readRequiredString(input, "instructions", issues, input.body);

  const runtime = readEnum(input.runtime, RUNTIME_BACKENDS, "runtime", issues, AGENT_DEFINITION_DEFAULTS.runtime);
  const tools = readStringList(input.tools, "tools", issues, AGENT_DEFINITION_DEFAULTS.tools);
  const disallowedTools = readStringList(
    input.disallowedTools,
    "disallowedTools",
    issues,
    AGENT_DEFINITION_DEFAULTS.disallowedTools,
  );
  const skills = readStringList(input.skills, "skills", issues, AGENT_DEFINITION_DEFAULTS.skills);
  const model = readOptionalString(input.model, "model", issues) ?? AGENT_DEFINITION_DEFAULTS.model;
  const thinking = readOptionalString(input.thinking, "thinking", issues);
  const reasoning = readOptionalString(input.reasoning, "reasoning", issues);

  const limits = isRecord(input.limits) ? input.limits : undefined;
  if (input.limits !== undefined && !limits) {
    issues.push({ path: "limits", message: "Limits must be an object." });
  }

  const maxTurns = readOptionalPositiveNumber(input.maxTurns ?? limits?.maxTurns, "maxTurns", issues);
  const maxRuntimeSec = readOptionalPositiveNumber(
    input.maxRuntimeSec ?? limits?.maxRuntimeSec,
    "maxRuntimeSec",
    issues,
  );
  const maxCostUsd = readOptionalNonNegativeNumber(input.maxCostUsd ?? limits?.maxCostUsd, "maxCostUsd", issues);
  const maxInputTokens = readOptionalPositiveNumber(
    input.maxInputTokens ?? limits?.maxInputTokens,
    "maxInputTokens",
    issues,
  );
  const maxOutputTokens = readOptionalPositiveNumber(
    input.maxOutputTokens ?? limits?.maxOutputTokens,
    "maxOutputTokens",
    issues,
  );
  const maxDepth = readOptionalPositiveNumber(input.maxDepth ?? limits?.maxDepth, "maxDepth", issues);
  const nestedSubagents = readOptionalBoolean(
    input.nestedSubagents ?? limits?.nestedSubagents,
    "nestedSubagents",
    issues,
  ) ?? AGENT_DEFINITION_DEFAULTS.nestedSubagents;

  const context = isRecord(input.context) ? input.context : undefined;
  if (input.context !== undefined && !context) {
    issues.push({ path: "context", message: "Context must be an object." });
  }
  if (limits) {
    rejectUnknownKeys(limits, LIMIT_KEYS, "limits", issues);
  }
  if (context) {
    rejectUnknownKeys(context, CONTEXT_KEYS, "context", issues);
  }
  const inheritContext = readEnum(
    input.inheritContext ?? context?.inherit,
    CONTEXT_INHERITANCE_MODES,
    "inheritContext",
    issues,
    AGENT_DEFINITION_DEFAULTS.inheritContext,
  );

  const sandbox = readSandbox(input, issues);
  const outputSchema = readOutputSchema(input.outputSchema, issues);

  if (issues.length > 0 || !name || !description || !instructions) {
    return fail(issues);
  }

  return {
    ok: true,
    value: {
      name,
      description,
      instructions,
      runtime,
      tools,
      disallowedTools,
      skills,
      model,
      ...(thinking ? { thinking } : {}),
      ...(reasoning ? { reasoning } : {}),
      ...(maxTurns !== undefined ? { maxTurns } : {}),
      ...(maxRuntimeSec !== undefined ? { maxRuntimeSec } : {}),
      ...(maxCostUsd !== undefined ? { maxCostUsd } : {}),
      ...(maxInputTokens !== undefined ? { maxInputTokens } : {}),
      ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
      ...(maxDepth !== undefined ? { maxDepth } : {}),
      inheritContext,
      nestedSubagents,
      sandbox,
      ...(outputSchema !== undefined ? { outputSchema } : {}),
    },
  };
}

export function parseAgentDefinitions(inputs: unknown): AgentDefinition[] {
  const result = validateAgentDefinitions(inputs);
  if (!result.ok) {
    throw new AgentDefinitionValidationError(result.issues);
  }
  return result.value;
}

export function validateAgentDefinitions(inputs: unknown): ValidationResult<AgentDefinition[]> {
  if (!Array.isArray(inputs)) {
    return fail([{ path: "$", message: "Agent definitions must be an array." }]);
  }

  const issues: ValidationIssue[] = [];
  const values: Array<{ index: number; definition: AgentDefinition }> = [];

  for (const [index, input] of inputs.entries()) {
    const result = validateAgentDefinition(input);
    if (result.ok) {
      values.push({ index, definition: result.value });
    } else {
      issues.push(...result.issues.map((issue) => ({ ...issue, path: `[${index}].${issue.path}` })));
    }
  }

  const seen = new Map<string, number>();
  for (const { index, definition } of values) {
    const normalizedName = definition.name.toLowerCase();
    const firstIndex = seen.get(normalizedName);
    if (firstIndex === undefined) {
      seen.set(normalizedName, index);
    } else {
      issues.push({
        path: `[${index}].name`,
        message: `Duplicate agent name "${definition.name}"; first seen at [${firstIndex}].name.`,
      });
    }
  }

  return issues.length > 0 ? fail(issues) : { ok: true, value: values.map(({ definition }) => definition) };
}

function readSandbox(input: Record<string, unknown>, issues: ValidationIssue[]): AgentSandbox {
  const rawSandbox = isRecord(input.sandbox) ? input.sandbox : undefined;
  const permissions = isRecord(input.permissions) ? input.permissions : undefined;

  if (input.sandbox !== undefined && !rawSandbox) {
    issues.push({ path: "sandbox", message: "Sandbox must be an object." });
  }
  if (input.permissions !== undefined && !permissions) {
    issues.push({ path: "permissions", message: "Permissions must be an object." });
  }

  if (permissions) {
    rejectUnknownKeys(permissions, SANDBOX_KEYS, "permissions", issues);
  }
  if (rawSandbox) {
    rejectUnknownKeys(rawSandbox, SANDBOX_KEYS, "sandbox", issues);
  }
  const source = { ...(permissions ?? {}), ...(rawSandbox ?? {}) };
  const mcpServers =
    rawSandbox?.mcpServers ?? rawSandbox?.mcp ?? permissions?.mcpServers ?? permissions?.mcp ?? input.mcpServers;

  return {
    filesystem: readEnum(
      source.filesystem,
      FILESYSTEM_POLICIES,
      "sandbox.filesystem",
      issues,
      AGENT_DEFINITION_DEFAULTS.sandbox.filesystem,
    ),
    network: readEnum(
      source.network,
      NETWORK_POLICIES,
      "sandbox.network",
      issues,
      AGENT_DEFINITION_DEFAULTS.sandbox.network,
    ),
    shell: readEnum(source.shell, SHELL_POLICIES, "sandbox.shell", issues, AGENT_DEFINITION_DEFAULTS.sandbox.shell),
    mcpServers: readStringList(
      mcpServers,
      "sandbox.mcpServers",
      issues,
      AGENT_DEFINITION_DEFAULTS.sandbox.mcpServers,
    ),
    childExtensions: readEnum(
      source.childExtensions,
      CHILD_EXTENSION_POLICIES,
      "sandbox.childExtensions",
      issues,
      AGENT_DEFINITION_DEFAULTS.sandbox.childExtensions,
    ),
  };
}

function readRequiredString(
  input: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
  fallback?: unknown,
): string | undefined {
  const value = input[key] ?? fallback;
  if (value === undefined) {
    issues.push({ path: key, message: `${key} is required.` });
    return undefined;
  }
  return readOptionalString(value, key, issues);
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

function readStringList(value: unknown, path: string, issues: ValidationIssue[], fallback: readonly string[]): string[] {
  if (value === undefined) {
    return [...fallback];
  }
  if (!Array.isArray(value)) {
    issues.push({ path, message: `${path} must be an array of strings.` });
    return [];
  }

  const strings: string[] = [];
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    const parsed = readOptionalString(item, itemPath, issues);
    if (!parsed) {
      return;
    }
    if (parsed === "*" || parsed.toLowerCase() === "all") {
      issues.push({ path: itemPath, message: "Wildcard allowlists are not allowed; list explicit entries." });
      return;
    }
    strings.push(parsed);
  });
  return strings;
}

function readEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
  issues: ValidationIssue[],
  fallback: T[number],
): T[number] {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "string" || !allowed.includes(value as T[number])) {
    issues.push({ path, message: `${path} must be one of: ${allowed.join(", ")}.` });
    return fallback;
  }
  return value;
}

function readOptionalPositiveNumber(value: unknown, path: string, issues: ValidationIssue[]): number | undefined {
  return readNumber(value, path, issues, (number) => number > 0, "must be greater than 0");
}

function readOptionalNonNegativeNumber(value: unknown, path: string, issues: ValidationIssue[]): number | undefined {
  return readNumber(value, path, issues, (number) => number >= 0, "must be 0 or greater");
}

function readNumber(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  valid: (value: number) => boolean,
  rule: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || !valid(value)) {
    issues.push({ path, message: `${path} ${rule}.` });
    return undefined;
  }
  return value;
}

function readOptionalBoolean(value: unknown, path: string, issues: ValidationIssue[]): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    issues.push({ path, message: `${path} must be a boolean.` });
    return undefined;
  }
  return value;
}

function readOutputSchema(value: unknown, issues: ValidationIssue[]): string | Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      issues.push({ path: "outputSchema", message: "outputSchema must not be empty." });
      return undefined;
    }
    return trimmed;
  }
  if (isRecord(value)) {
    return value;
  }
  issues.push({ path: "outputSchema", message: "outputSchema must be a string or object." });
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
