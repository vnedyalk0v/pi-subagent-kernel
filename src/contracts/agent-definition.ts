export const AGENT_NAME_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;

export const RUNTIME_BACKENDS = Object.freeze(["sdk", "subprocess", "worktree", "mux", "remote", "auto"] as const);
export type RuntimeBackend = (typeof RUNTIME_BACKENDS)[number];

export const CONTEXT_INHERITANCE_MODES = Object.freeze(["none", "summary", "fork", "full"] as const);
export type ContextInheritanceMode = (typeof CONTEXT_INHERITANCE_MODES)[number];

export const FILESYSTEM_POLICIES = Object.freeze([
  "none",
  "read-only",
  "workspace-write",
  "worktree-write",
  "unrestricted",
] as const);
export type FilesystemPolicy = (typeof FILESYSTEM_POLICIES)[number];

export const NETWORK_POLICIES = Object.freeze(["none", "docs-only", "ask", "allow"] as const);
export type NetworkPolicy = (typeof NETWORK_POLICIES)[number];

export const SHELL_POLICIES = Object.freeze(["none", "test-only", "ask", "allow"] as const);
export type ShellPolicy = (typeof SHELL_POLICIES)[number];

export const CHILD_EXTENSION_POLICIES = Object.freeze(["deny-by-default", "allow"] as const);
export type ChildExtensionPolicy = (typeof CHILD_EXTENSION_POLICIES)[number];

export const RESULT_MODES = Object.freeze(["summary", "json", "patch", "artifact", "mixed"] as const);
export type ResultMode = (typeof RESULT_MODES)[number];

export const RESERVED_AGENT_NAMES = new Set(["subagent_spawn", "subagent_status", "subagent_result", "subagent_cancel"]);

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
  maxThreads?: number;
  inheritContext: ContextInheritanceMode;
  includeFiles?: string[];
  excludeFiles?: string[];
  parentSummaryMaxTokens?: number;
  attachRecentDiff?: boolean;
  nestedSubagents: boolean;
  sandbox: AgentSandbox;
  outputSchema?: string | Record<string, unknown>;
  resultMode?: ResultMode;
  tags?: string[];
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
  maxDepth: 1,
  maxThreads: 4,
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
  "maxThreads",
  "inheritContext",
  "nestedSubagents",
  "sandbox",
  "permissions",
  "mcpServers",
  "context",
  "limits",
  "outputSchema",
  "resultMode",
  "tags",
]);

const LIMIT_KEYS = new Set([
  "maxTurns",
  "maxRuntimeSec",
  "maxCostUsd",
  "maxInputTokens",
  "maxOutputTokens",
  "maxDepth",
  "maxThreads",
]);
const CONTEXT_KEYS = new Set(["inherit", "includeFiles", "excludeFiles", "parentSummaryMaxTokens", "attachRecentDiff"]);
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
  if (name && RESERVED_AGENT_NAMES.has(name.toLowerCase())) {
    issues.push({ path: "name", message: `Name "${name}" is reserved for a subagent tool.` });
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

  const maxTurns = readLimit(input, limits, "maxTurns", issues, readOptionalPositiveInteger);
  const maxRuntimeSec = readLimit(input, limits, "maxRuntimeSec", issues, readOptionalPositiveInteger);
  const maxCostUsd = readLimit(input, limits, "maxCostUsd", issues, readOptionalNonNegativeNumber);
  const maxInputTokens = readLimit(input, limits, "maxInputTokens", issues, readOptionalPositiveInteger);
  const maxOutputTokens = readLimit(input, limits, "maxOutputTokens", issues, readOptionalPositiveInteger);
  const maxDepth = readLimit(input, limits, "maxDepth", issues, readOptionalPositiveInteger) ?? AGENT_DEFINITION_DEFAULTS.maxDepth;
  const maxThreads = readLimit(input, limits, "maxThreads", issues, readOptionalPositiveInteger) ?? AGENT_DEFINITION_DEFAULTS.maxThreads;
  const nestedSubagents = readOptionalBoolean(input.nestedSubagents, "nestedSubagents", issues) ?? AGENT_DEFINITION_DEFAULTS.nestedSubagents;

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
  const nestedInheritContext = context && hasOwn(context, "inherit")
    ? readOptionalEnum(context.inherit, CONTEXT_INHERITANCE_MODES, "context.inherit", issues)
    : undefined;
  const inheritContext = hasOwn(input, "inheritContext")
    ? readEnum(input.inheritContext, CONTEXT_INHERITANCE_MODES, "inheritContext", issues, AGENT_DEFINITION_DEFAULTS.inheritContext)
    : nestedInheritContext ?? AGENT_DEFINITION_DEFAULTS.inheritContext;
  if (inheritContext === "full" || nestedInheritContext === "full") {
    issues.push({
      path: inheritContext === "full" && hasOwn(input, "inheritContext") ? "inheritContext" : "context.inherit",
      message: "inheritContext full requires spawn-time policy approval and cannot be set by an agent definition.",
    });
  }
  const includeFiles = readStringList(context?.includeFiles, "context.includeFiles", issues, [], { allowWildcard: true });
  const excludeFiles = readStringList(context?.excludeFiles, "context.excludeFiles", issues, [], { allowWildcard: true });
  const parentSummaryMaxTokens = readOptionalPositiveInteger(
    context?.parentSummaryMaxTokens,
    "context.parentSummaryMaxTokens",
    issues,
  );
  const attachRecentDiff = readOptionalBoolean(context?.attachRecentDiff, "context.attachRecentDiff", issues);

  const sandbox = readSandbox(input, issues);
  const outputSchema = readOutputSchema(input.outputSchema, issues);
  const resultMode = readOptionalEnum(input.resultMode, RESULT_MODES, "resultMode", issues);
  const tags = readStringList(input.tags, "tags", issues, []);

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
      maxDepth,
      maxThreads,
      inheritContext,
      ...(context && hasOwn(context, "includeFiles") ? { includeFiles } : {}),
      ...(context && hasOwn(context, "excludeFiles") ? { excludeFiles } : {}),
      ...(parentSummaryMaxTokens !== undefined ? { parentSummaryMaxTokens } : {}),
      ...(attachRecentDiff !== undefined ? { attachRecentDiff } : {}),
      nestedSubagents,
      sandbox,
      ...(outputSchema !== undefined ? { outputSchema } : {}),
      ...(resultMode !== undefined ? { resultMode } : {}),
      ...(hasOwn(input, "tags") ? { tags } : {}),
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

  const topLevelMcpServers = readMcpServers(input, "mcpServers", "mcpServers", issues);
  const permissionSandbox = readSandboxLayer(permissions, "permissions", issues);
  const agentSandbox = readSandboxLayer(rawSandbox, "sandbox", issues);

  return {
    filesystem: agentSandbox.filesystem ?? permissionSandbox.filesystem ?? AGENT_DEFINITION_DEFAULTS.sandbox.filesystem,
    network: agentSandbox.network ?? permissionSandbox.network ?? AGENT_DEFINITION_DEFAULTS.sandbox.network,
    shell: agentSandbox.shell ?? permissionSandbox.shell ?? AGENT_DEFINITION_DEFAULTS.sandbox.shell,
    mcpServers: agentSandbox.mcpServers ?? permissionSandbox.mcpServers ?? topLevelMcpServers,
    childExtensions:
      agentSandbox.childExtensions ?? permissionSandbox.childExtensions ?? AGENT_DEFINITION_DEFAULTS.sandbox.childExtensions,
  };
}

function readSandboxLayer(
  input: Record<string, unknown> | undefined,
  path: string,
  issues: ValidationIssue[],
): Partial<AgentSandbox> {
  if (!input) {
    return {};
  }

  const explicitMcpServers = hasOwn(input, "mcpServers")
    ? readMcpServers(input, "mcpServers", `${path}.mcpServers`, issues)
    : undefined;
  const mcpAlias = hasOwn(input, "mcp") ? readMcpServers(input, "mcp", `${path}.mcp`, issues) : undefined;
  const mcpServers = explicitMcpServers ?? mcpAlias;

  return {
    ...(hasOwn(input, "filesystem")
      ? { filesystem: readOptionalEnum(input.filesystem, FILESYSTEM_POLICIES, `${path}.filesystem`, issues) }
      : {}),
    ...(hasOwn(input, "network") ? { network: readOptionalEnum(input.network, NETWORK_POLICIES, `${path}.network`, issues) } : {}),
    ...(hasOwn(input, "shell") ? { shell: readOptionalEnum(input.shell, SHELL_POLICIES, `${path}.shell`, issues) } : {}),
    ...(mcpServers !== undefined ? { mcpServers } : {}),
    ...(hasOwn(input, "childExtensions")
      ? {
          childExtensions: readOptionalEnum(
            input.childExtensions,
            CHILD_EXTENSION_POLICIES,
            `${path}.childExtensions`,
            issues,
          ),
        }
      : {}),
  };
}

function readMcpServers(
  input: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): string[] {
  const value = hasOwn(input, key) ? input[key] : undefined;
  return readStringList(isRecord(value) ? Object.keys(value) : value, path, issues, AGENT_DEFINITION_DEFAULTS.sandbox.mcpServers);
}

function readRequiredString(
  input: Record<string, unknown>,
  key: string,
  issues: ValidationIssue[],
  fallback?: unknown,
): string | undefined {
  const value = hasOwn(input, key) ? input[key] : fallback;
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

function readStringList(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  fallback: readonly string[],
  options: { allowWildcard?: boolean } = {},
): string[] {
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
    if (!options.allowWildcard && (parsed.includes("*") || parsed.toLowerCase() === "all")) {
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
  return readOptionalEnum(value, allowed, path, issues) ?? fallback;
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

function readOptionalPositiveInteger(value: unknown, path: string, issues: ValidationIssue[]): number | undefined {
  return readNumber(value, path, issues, (number) => Number.isInteger(number) && number > 0, "must be a positive integer");
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

function readLimit<T>(
  input: Record<string, unknown>,
  limits: Record<string, unknown> | undefined,
  key: string,
  issues: ValidationIssue[],
  read: (value: unknown, path: string, issues: ValidationIssue[]) => T | undefined,
): T | undefined {
  const nested = limits && hasOwn(limits, key) ? read(limits[key], `limits.${key}`, issues) : undefined;
  return hasOwn(input, key) ? read(input[key], key, issues) : nested;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
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
