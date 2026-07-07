import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { validateAgentDefinition, type AgentDefinition, type ValidationIssue } from "../contracts/agent-definition.ts";
import { MarkdownAgentParseError, parseMarkdownAgentDocument, type MarkdownAgentIssue } from "./markdown-agent.ts";

export interface PiAgentLoaderIssue {
  file: string;
  message: string;
  line?: number;
  path?: string;
}

export interface LoadPiAgentDefinitionsOptions {
  trusted?: boolean;
}

export class PiAgentLoaderError extends Error {
  readonly issues: PiAgentLoaderIssue[];

  constructor(issues: PiAgentLoaderIssue[]) {
    super(`Invalid Pi agent definition: ${issues.map(formatIssue).join("; ")}`);
    this.name = "PiAgentLoaderError";
    this.issues = issues;
  }
}

export async function loadPiAgentDefinitions(
  rootDir: string,
  options: LoadPiAgentDefinitionsOptions = {},
): Promise<AgentDefinition[]> {
  const agentsDir = join(rootDir, ".pi", "agents");
  const entries = await readAgentDir(agentsDir);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(agentsDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (files.length > 0 && !options.trusted) {
    throw new PiAgentLoaderError([
      { file: agentsDir, message: "Project-local agent definitions require trusted: true before loading." },
    ]);
  }

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
  let parsed: { frontmatter: Record<string, unknown>; body: string };
  try {
    parsed = parseMarkdownAgentDocument(source, file);
  } catch (error) {
    if (error instanceof MarkdownAgentParseError) {
      throw new PiAgentLoaderError(error.issues.map(toPiIssue));
    }
    throw error;
  }

  const instructions = parsed.body.trim();
  if (!instructions) {
    throw new PiAgentLoaderError([{ file, path: "instructions", message: "Markdown instructions body is required." }]);
  }

  const result = validateAgentDefinition({ ...parsed.frontmatter, instructions });
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

function toPiIssue(issue: MarkdownAgentIssue): PiAgentLoaderIssue {
  return {
    file: issue.file,
    message: issue.message,
    ...(issue.line !== undefined ? { line: issue.line } : {}),
    ...(issue.path ? { path: issue.path } : {}),
  };
}

function toLoaderIssue(file: string, issue: ValidationIssue): PiAgentLoaderIssue {
  return { file, path: issue.path, message: issue.message };
}

function formatIssue(issue: PiAgentLoaderIssue): string {
  const location = [issue.file, issue.line, issue.path].filter((part) => part !== undefined && part !== "").join(":");
  return `${location}: ${issue.message}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
