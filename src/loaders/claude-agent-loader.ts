import { glob, readFile } from "node:fs/promises";
import { join } from "node:path";

import { validateAgentDefinition, type AgentDefinition, type ValidationIssue } from "../contracts/agent-definition.ts";
import { MarkdownAgentParseError, parseMarkdownAgentDocument, type MarkdownAgentIssue } from "./markdown-agent.ts";

export interface ClaudeAgentLoaderIssue {
  file: string;
  message: string;
  line?: number;
  path?: string;
}

export interface ClaudeAgentImportWarning {
  file: string;
  message: string;
  path?: string;
}

export interface ClaudeAgentImportResult {
  definition: AgentDefinition;
  warnings: readonly ClaudeAgentImportWarning[];
}

export interface LoadClaudeAgentDefinitionsOptions {
  trusted?: boolean;
}

export class ClaudeAgentLoaderError extends Error {
  readonly issues: ClaudeAgentLoaderIssue[];

  constructor(issues: ClaudeAgentLoaderIssue[]) {
    super(`Invalid Claude agent definition: ${issues.map(formatIssue).join("; ")}`);
    this.name = "ClaudeAgentLoaderError";
    this.issues = issues;
  }
}

const CLAUDE_AGENT_KEYS = new Set(["name", "description", "tools", "disallowedTools", "model", "mcpServers", "skills", "maxTurns"]);
const CLAUDE_TOOL_ALIASES = new Map([
  ["read", "read"],
  ["grep", "grep"],
  ["glob", "find"],
  ["ls", "ls"],
  ["bash", "bash"],
  ["edit", "edit"],
  ["multiedit", "edit"],
  ["write", "write"],
  ["task", "subagent_spawn"],
  ["agent", "subagent_spawn"],
]);

export async function loadClaudeAgentDefinitions(
  rootDir: string,
  options: LoadClaudeAgentDefinitionsOptions = {},
): Promise<ClaudeAgentImportResult[]> {
  const agentsDir = join(rootDir, ".claude", "agents");
  const files = await readMarkdownFiles(agentsDir);

  if (files.length > 0 && !options.trusted) {
    throw new ClaudeAgentLoaderError([
      { file: agentsDir, message: "Project-local Claude agent definitions require trusted: true before importing." },
    ]);
  }

  const loaded: Array<{ file: string; result: ClaudeAgentImportResult }> = [];
  const issues: ClaudeAgentLoaderIssue[] = [];

  for (const file of files) {
    try {
      const source = await readFile(file, "utf8");
      loaded.push({ file, result: parseClaudeAgentMarkdown(source, file) });
    } catch (error) {
      if (error instanceof ClaudeAgentLoaderError) {
        issues.push(...error.issues);
      } else {
        issues.push({ file, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  issues.push(...findDuplicateNames(loaded));

  if (issues.length > 0) {
    throw new ClaudeAgentLoaderError(issues);
  }

  return loaded.map(({ result }) => result);
}

export function parseClaudeAgentMarkdown(source: string, file = "<claude-agent>"): ClaudeAgentImportResult {
  let parsed: { frontmatter: Record<string, unknown>; body: string };
  try {
    parsed = parseMarkdownAgentDocument(source, file);
  } catch (error) {
    if (error instanceof MarkdownAgentParseError) {
      throw new ClaudeAgentLoaderError(error.issues.map(toClaudeIssue));
    }
    throw error;
  }

  const instructions = parsed.body.trim();
  if (!instructions) {
    throw new ClaudeAgentLoaderError([{ file, path: "instructions", message: "Markdown instructions body is required." }]);
  }

  const warnings: ClaudeAgentImportWarning[] = [];
  const normalized = normalizeClaudeAgent(parsed.frontmatter, instructions, file, warnings);
  const result = validateAgentDefinition(normalized);
  if (!result.ok) {
    throw new ClaudeAgentLoaderError(result.issues.map((issue) => toLoaderIssue(file, issue)));
  }

  return { definition: result.value, warnings };
}

async function readMarkdownFiles(agentsDir: string): Promise<string[]> {
  try {
    const files: string[] = [];
    for await (const file of glob("**/*.md", { cwd: agentsDir })) {
      files.push(join(agentsDir, file));
    }
    return files.sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function normalizeClaudeAgent(
  raw: Record<string, unknown>,
  instructions: string,
  file: string,
  warnings: ClaudeAgentImportWarning[],
): Record<string, unknown> {
  const unsupported = unsupportedFields(raw, file, warnings);
  const compatClaude: Record<string, unknown> = {};
  if (Object.keys(unsupported).length > 0) {
    compatClaude.unsupported = unsupported;
  }

  const normalized: Record<string, unknown> = {
    name: raw.name,
    description: raw.description,
    instructions,
  };

  const disallowedTools = hasOwn(raw, "disallowedTools")
    ? normalizeClaudeToolList(raw.disallowedTools, "disallowedTools", file, warnings, compatClaude)
    : undefined;
  const tools = hasOwn(raw, "tools")
    ? normalizeClaudeToolList(raw.tools, "tools", file, warnings, compatClaude)
    : [];

  if (!hasOwn(raw, "tools")) {
    compatClaude.inheritedTools = true;
    warnings.push({
      file,
      path: "tools",
      message: "Claude omitted tools; Pi import uses an empty allowlist instead of inheriting all tools.",
    });
  }

  normalized.tools = applyDisallowedTools(tools, disallowedTools, file, warnings);
  if (disallowedTools !== undefined) {
    normalized.disallowedTools = disallowedTools;
  }
  if (hasOwn(raw, "model")) {
    normalized.model = raw.model;
  }
  if (hasOwn(raw, "skills")) {
    normalized.skills = normalizeStringListLike(raw.skills);
  }
  if (hasOwn(raw, "maxTurns")) {
    normalized.maxTurns = raw.maxTurns;
  }
  if (hasOwn(raw, "mcpServers")) {
    normalized.mcpServers = normalizeClaudeMcpServers(raw.mcpServers, file, warnings, compatClaude);
    warnings.push({
      file,
      path: "mcpServers",
      message: "Claude MCP servers are imported as requested servers; spawn still requires an explicit MCP allowlist.",
    });
  }

  const warningMessages = warnings.map((warning) => (warning.path ? `${warning.path}: ${warning.message}` : warning.message));
  normalized.compat = {
    source: "claude",
    sourcePath: file,
    lossy: warningMessages.length > 0,
    warnings: warningMessages,
    claude: compatClaude,
  };

  return normalized;
}

function unsupportedFields(
  raw: Record<string, unknown>,
  file: string,
  warnings: ClaudeAgentImportWarning[],
): Record<string, unknown> {
  const unsupported: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!CLAUDE_AGENT_KEYS.has(key)) {
      unsupported[key] = value;
      warnings.push({
        file,
        path: key,
        message: `Unsupported Claude field "${key}" was preserved under compat.claude.unsupported and is not executed.`,
      });
    }
  }
  return unsupported;
}

function normalizeClaudeToolList(
  value: unknown,
  path: string,
  file: string,
  warnings: ClaudeAgentImportWarning[],
  compatClaude: Record<string, unknown>,
): unknown {
  const list = normalizeStringListLike(value);
  if (!Array.isArray(list)) {
    return list;
  }

  return list.map((tool, index) => {
    if (typeof tool !== "string") {
      return tool;
    }
    const trimmed = tool.trim();
    const scoped = /^(?<name>[A-Za-z][A-Za-z0-9_-]*)\(.+\)$/.exec(trimmed);
    const aliasKey = (scoped?.groups?.name ?? trimmed).toLowerCase();
    const normalized = CLAUDE_TOOL_ALIASES.get(aliasKey) ?? trimmed;
    if (aliasKey === "glob") {
      warnings.push({ file, path: `${path}[${index}]`, message: "Claude Glob maps to Pi find; glob semantics are not identical." });
    }
    if (scoped) {
      const scopedTools = Array.isArray(compatClaude.scopedTools) ? compatClaude.scopedTools : [];
      scopedTools.push(trimmed);
      compatClaude.scopedTools = scopedTools;
      warnings.push({
        file,
        path: `${path}[${index}]`,
        message: `Claude scoped tool "${trimmed}" maps to "${normalized}"; scoped arguments are preserved as metadata only.`,
      });
    }
    return normalized;
  });
}

function applyDisallowedTools(
  tools: unknown,
  disallowedTools: unknown,
  file: string,
  warnings: ClaudeAgentImportWarning[],
): unknown {
  if (!Array.isArray(tools) || !Array.isArray(disallowedTools)) {
    return tools;
  }
  const denied = new Set(disallowedTools.filter((tool): tool is string => typeof tool === "string"));
  const filtered = tools.filter((tool) => typeof tool !== "string" || !denied.has(tool));
  if (filtered.length !== tools.length) {
    warnings.push({
      file,
      path: "tools",
      message: "Claude disallowedTools removed matching entries from the imported tools allowlist.",
    });
  }
  return filtered;
}

function normalizeClaudeMcpServers(
  value: unknown,
  file: string,
  warnings: ClaudeAgentImportWarning[],
  compatClaude: Record<string, unknown>,
): unknown {
  if (Array.isArray(value)) {
    const names: unknown[] = [];
    value.forEach((item, index) => {
      if (typeof item === "string") {
        names.push(item);
      } else if (isRecord(item)) {
        for (const [name, config] of Object.entries(item)) {
          names.push(name);
          rememberMcpConfig(compatClaude, name, config);
        }
        warnings.push({
          file,
          path: `mcpServers[${index}]`,
          message: "Inline Claude MCP server config was preserved under compat.claude.mcpServers and is not executed.",
        });
      } else {
        names.push(item);
      }
    });
    return names;
  }
  if (isRecord(value)) {
    for (const [name, config] of Object.entries(value)) {
      rememberMcpConfig(compatClaude, name, config);
    }
    return Object.keys(value);
  }
  return normalizeStringListLike(value);
}

function normalizeStringListLike(value: unknown): unknown {
  if (typeof value === "string") {
    return splitTopLevelCommas(value);
  }
  return value;
}

function splitTopLevelCommas(value: string): string[] {
  const items: string[] = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")" && depth > 0) {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      items.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  items.push(value.slice(start).trim());
  return items.filter(Boolean);
}

function rememberMcpConfig(compatClaude: Record<string, unknown>, name: string, config: unknown): void {
  const existing = isRecord(compatClaude.mcpServers) ? compatClaude.mcpServers : {};
  existing[name] = config;
  compatClaude.mcpServers = existing;
}

function findDuplicateNames(loaded: Array<{ file: string; result: ClaudeAgentImportResult }>): ClaudeAgentLoaderIssue[] {
  const seen = new Map<string, { file: string }>();
  const issues: ClaudeAgentLoaderIssue[] = [];

  for (const { file, result } of loaded) {
    const key = result.definition.name.toLowerCase();
    const first = seen.get(key);
    if (first) {
      issues.push({
        file,
        path: "name",
        message: `Duplicate agent name "${result.definition.name}"; first seen in ${first.file}.`,
      });
    } else {
      seen.set(key, { file });
    }
  }

  return issues;
}

function toClaudeIssue(issue: MarkdownAgentIssue): ClaudeAgentLoaderIssue {
  return {
    file: issue.file,
    message: issue.message,
    ...(issue.line !== undefined ? { line: issue.line } : {}),
    ...(issue.path ? { path: issue.path } : {}),
  };
}

function toLoaderIssue(file: string, issue: ValidationIssue): ClaudeAgentLoaderIssue {
  return { file, path: issue.path, message: issue.message };
}

function formatIssue(issue: ClaudeAgentLoaderIssue): string {
  const location = [issue.file, issue.line, issue.path].filter((part) => part !== undefined && part !== "").join(":");
  return `${location}: ${issue.message}`;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
