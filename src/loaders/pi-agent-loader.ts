import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { LineCounter, parseDocument } from "yaml";

import { validateAgentDefinition, type AgentDefinition, type ValidationIssue } from "../contracts/agent-definition.ts";

export interface PiAgentLoaderIssue {
  file: string;
  message: string;
  line?: number;
  path?: string;
}

export class PiAgentLoaderError extends Error {
  readonly issues: PiAgentLoaderIssue[];

  constructor(issues: PiAgentLoaderIssue[]) {
    super(`Invalid Pi agent definition: ${issues.map(formatIssue).join("; ")}`);
    this.name = "PiAgentLoaderError";
    this.issues = issues;
  }
}

export async function loadPiAgentDefinitions(rootDir: string): Promise<AgentDefinition[]> {
  const agentsDir = join(rootDir, ".pi", "agents");
  const entries = await readAgentDir(agentsDir);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(agentsDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  const loaded: Array<{ file: string; definition: AgentDefinition }> = [];
  const issues: PiAgentLoaderIssue[] = [];

  for (const file of files) {
    try {
      const source = await readFile(file, "utf8");
      loaded.push({ file, definition: parsePiAgentMarkdown(source, file) });
    } catch (error) {
      if (error instanceof PiAgentLoaderError) {
        issues.push(...error.issues);
      } else {
        issues.push({ file, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  issues.push(...findDuplicateNames(loaded));

  if (issues.length > 0) {
    throw new PiAgentLoaderError(issues);
  }

  return loaded.map(({ definition }) => definition);
}

export function parsePiAgentMarkdown(source: string, file = "<agent>"): AgentDefinition {
  const parts = splitFrontmatter(source, file);
  const raw = parseYamlObject(parts.frontmatter, file, 2);
  const instructions = parts.body.trim();

  if (!instructions) {
    throw new PiAgentLoaderError([{ file, path: "instructions", message: "Markdown instructions body is required." }]);
  }

  const result = validateAgentDefinition({ ...raw, instructions });
  if (!result.ok) {
    throw new PiAgentLoaderError(result.issues.map((issue) => toLoaderIssue(file, issue)));
  }
  return result.value;
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

function splitFrontmatter(source: string, file: string): { frontmatter: string; body: string } {
  const text = source.startsWith("\uFEFF") ? source.slice(1) : source;
  const lines = text.split(/\r?\n/);

  if (lines[0] !== "---") {
    throw new PiAgentLoaderError([{ file, line: 1, message: "Missing YAML frontmatter delimiter '---'." }]);
  }

  const end = lines.findIndex((line, index) => index > 0 && line === "---");
  if (end === -1) {
    throw new PiAgentLoaderError([{ file, line: 1, message: "Missing closing YAML frontmatter delimiter '---'." }]);
  }

  return {
    frontmatter: lines.slice(1, end).join("\n"),
    body: lines.slice(end + 1).join("\n"),
  };
}

function parseYamlObject(source: string, file: string, lineOffset: number): Record<string, unknown> {
  const lineCounter = new LineCounter();
  const document = parseDocument(source, {
    lineCounter,
    strict: true,
    uniqueKeys: true,
  });
  const issues = [...document.errors, ...document.warnings].map((error) => toYamlIssue(file, error, lineOffset));

  if (issues.length > 0) {
    throw new PiAgentLoaderError(issues);
  }

  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new PiAgentLoaderError([{ file, message: error instanceof Error ? error.message : String(error) }]);
  }

  if (!isRecord(value)) {
    throw new PiAgentLoaderError([{ file, line: lineOffset, message: "YAML frontmatter must be an object." }]);
  }

  return value;
}

function findDuplicateNames(loaded: Array<{ file: string; definition: AgentDefinition }>): PiAgentLoaderIssue[] {
  const seen = new Map<string, { file: string }>();
  const issues: PiAgentLoaderIssue[] = [];

  for (const { file, definition } of loaded) {
    const key = definition.name.toLowerCase();
    const first = seen.get(key);
    if (first) {
      issues.push({
        file,
        path: "name",
        message: `Duplicate agent name "${definition.name}"; first seen in ${first.file}.`,
      });
    } else {
      seen.set(key, { file });
    }
  }

  return issues;
}

function toYamlIssue(file: string, error: { message: string; linePos?: Array<{ line: number }> }, lineOffset: number): PiAgentLoaderIssue {
  const position = error.linePos?.[0];
  return {
    file,
    ...(position ? { line: lineOffset + position.line - 1 } : {}),
    message: error.message,
  };
}

function toLoaderIssue(file: string, issue: ValidationIssue): PiAgentLoaderIssue {
  return { file, path: issue.path, message: issue.message };
}

function formatIssue(issue: PiAgentLoaderIssue): string {
  const location = [issue.file, issue.line, issue.path].filter((part) => part !== undefined && part !== "").join(":");
  return `${location}: ${issue.message}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
