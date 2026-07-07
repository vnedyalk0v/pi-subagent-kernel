import { readdir, readFile } from "node:fs/promises";
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

const CLAUDE_AGENT_KEYS = new Set(["name", "description", "tools", "disallowedTools", "model", "mcpServers", "skills"]);
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
  const entries = await readAgentDir(agentsDir);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(agentsDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

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

async function readAgentDir(agentsDir: string) {
  try {
    return await readdir(agentsDir, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
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

  if (hasOwn(raw, "tools")) {
    normalized.tools = normalizeClaudeToolList(raw.tools, "tools", file, warnings);
  } else {
    normalized.tools = [];
    compatClaude.inheritedTools = true;
    warnings.push({
      file,
      path: "tools",
      message: "Claude omitted tools; Pi import uses an empty allowlist instead of inheriting all tools.",
    });
  }

  if (hasOwn(raw, "disallowedTools")) {
    normalized.disallowedTools = normalizeClaudeToolList(raw.disallowedTools, "disallowedTools", file, warnings);
  }
  if (hasOwn(raw, "model")) {
    normalized.model = raw.model;
  }
  if (hasOwn(raw, "skills")) {
    normalized.skills = normalizeStringListLike(raw.skills);
  }
  if (hasOwn(raw, "mcpServers")) {
    normalized.mcpServers = raw.mcpServers;
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
): unknown {
  const list = normalizeStringListLike(value);
  if (!Array.isArray(list)) {
    return list;
  }

  return list.map((tool, index) => {
    if (typeof tool !== "string") {
      return tool;
    }
    const normalized = CLAUDE_TOOL_ALIASES.get(tool.trim().toLowerCase()) ?? tool.trim();
    if (tool.trim().toLowerCase() === "glob") {
      warnings.push({ file, path: `${path}[${index}]`, message: "Claude Glob maps to Pi find; glob semantics are not identical." });
    }
    return normalized;
  });
}

function normalizeStringListLike(value: unknown): unknown {
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return value;
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
