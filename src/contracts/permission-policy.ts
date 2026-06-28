import {
  CHILD_EXTENSION_POLICIES,
  FILESYSTEM_POLICIES,
  NETWORK_POLICIES,
  SHELL_POLICIES,
  type ChildExtensionPolicy,
  type FilesystemPolicy,
  type NetworkPolicy,
  type ShellPolicy,
  type ValidationIssue,
  type ValidationResult,
} from "./agent-definition.ts";

const TOP_LEVEL_PERMISSION_POLICY_KEYS = new Set([
  "maxDepth",
  "maxThreads",
  "nestedSubagents",
  "filesystem",
  "network",
  "shell",
  "childExtensions",
  "mcpServers",
  "projectAgentsRequireTrust",
  "projectAgentsRequireConfirmation",
]);

export const MCP_SERVER_POLICIES = Object.freeze(["none", "allowlist-only", "ask", "allow"] as const);
export type McpServerPolicy = (typeof MCP_SERVER_POLICIES)[number];

// Validation-only contract. Later enforcement layers must cap requested policy against these safe defaults.
export interface PermissionPolicy {
  maxDepth: number;
  maxThreads: number;
  nestedSubagents: boolean;
  filesystem: FilesystemPolicy;
  network: NetworkPolicy;
  shell: ShellPolicy;
  childExtensions: ChildExtensionPolicy;
  mcpServers: McpServerPolicy;
  projectAgentsRequireTrust: boolean;
  projectAgentsRequireConfirmation: boolean;
}

export const DEFAULT_PERMISSION_POLICY: PermissionPolicy = deepFreeze({
  maxDepth: 1,
  maxThreads: 4,
  nestedSubagents: false,
  filesystem: "read-only",
  network: "none",
  shell: "none",
  childExtensions: "deny-by-default",
  mcpServers: "allowlist-only",
  projectAgentsRequireTrust: true,
  projectAgentsRequireConfirmation: true,
});

export class PermissionPolicyValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(`Invalid permission policy: ${issues.map(formatIssue).join("; ")}`);
    this.name = "PermissionPolicyValidationError";
    this.issues = issues;
  }
}

export function parsePermissionPolicy(input: unknown = {}): PermissionPolicy {
  const result = validatePermissionPolicy(input);
  if (!result.ok) {
    throw new PermissionPolicyValidationError(result.issues);
  }
  return result.value;
}

export function validatePermissionPolicy(input: unknown = {}): ValidationResult<PermissionPolicy> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return fail([{ path: "$", message: "Permission policy must be an object." }]);
  }

  rejectUnknownKeys(input, TOP_LEVEL_PERMISSION_POLICY_KEYS, "", issues);

  const maxDepth = readPositiveInteger(input.maxDepth, "maxDepth", issues) ?? DEFAULT_PERMISSION_POLICY.maxDepth;
  const maxThreads = readPositiveInteger(input.maxThreads, "maxThreads", issues) ?? DEFAULT_PERMISSION_POLICY.maxThreads;
  const nestedSubagents = readBoolean(input.nestedSubagents, "nestedSubagents", issues) ?? DEFAULT_PERMISSION_POLICY.nestedSubagents;
  const filesystem = readEnum(input.filesystem, FILESYSTEM_POLICIES, "filesystem", issues) ?? DEFAULT_PERMISSION_POLICY.filesystem;
  const network = readEnum(input.network, NETWORK_POLICIES, "network", issues) ?? DEFAULT_PERMISSION_POLICY.network;
  const shell = readEnum(input.shell, SHELL_POLICIES, "shell", issues) ?? DEFAULT_PERMISSION_POLICY.shell;
  const childExtensions =
    readEnum(input.childExtensions, CHILD_EXTENSION_POLICIES, "childExtensions", issues) ??
    DEFAULT_PERMISSION_POLICY.childExtensions;
  const mcpServers = readEnum(input.mcpServers, MCP_SERVER_POLICIES, "mcpServers", issues) ?? DEFAULT_PERMISSION_POLICY.mcpServers;
  const projectAgentsRequireTrust =
    readBoolean(input.projectAgentsRequireTrust, "projectAgentsRequireTrust", issues) ??
    DEFAULT_PERMISSION_POLICY.projectAgentsRequireTrust;
  const projectAgentsRequireConfirmation =
    readBoolean(input.projectAgentsRequireConfirmation, "projectAgentsRequireConfirmation", issues) ??
    DEFAULT_PERMISSION_POLICY.projectAgentsRequireConfirmation;

  return issues.length > 0
    ? fail(issues)
    : {
        ok: true,
        value: deepFreeze({
          maxDepth,
          maxThreads,
          nestedSubagents,
          filesystem,
          network,
          shell,
          childExtensions,
          mcpServers,
          projectAgentsRequireTrust,
          projectAgentsRequireConfirmation,
        }),
      };
}

function readPositiveInteger(value: unknown, path: string, issues: ValidationIssue[]): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    issues.push({ path, message: `${path} must be a positive integer.` });
    return undefined;
  }
  return value;
}

function readBoolean(value: unknown, path: string, issues: ValidationIssue[]): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    issues.push({ path, message: `${path} must be a boolean.` });
    return undefined;
  }
  return value;
}

function readEnum<const T extends readonly string[]>(
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
