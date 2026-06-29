import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

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

interface YamlLine {
  indent: number;
  line: number;
  text: string;
}

function parseYamlObject(source: string, file: string, lineOffset: number): Record<string, unknown> {
  const lines = toYamlLines(source, file, lineOffset);
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; value: Record<string, unknown> | unknown[] }> = [{ indent: -1, value: root }];

  lines.forEach((line, index) => {
    while (stack.length > 1) {
      const top = stack[stack.length - 1];
      if (!top || top.indent < line.indent) {
        break;
      }
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (!parent) {
      throw yamlError(file, line, "Unexpected YAML parser state.");
    }
    if (parent.indent === -1 && line.indent !== 0) {
      throw yamlError(file, line, "Top-level YAML keys must not be indented.");
    }

    if (line.text.startsWith("-")) {
      if (!Array.isArray(parent.value)) {
        throw yamlError(file, line, "Unexpected list item; expected a key/value pair.");
      }
      const raw = line.text.slice(1).trim();
      if (/^[A-Za-z][A-Za-z0-9_-]*:(?:\s|$)/.test(raw)) {
        throw yamlError(file, line, "List item mappings are not supported by the MVP YAML parser.");
      }
      parent.value.push(parseScalar(raw, file, line.line));
      return;
    }

    if (Array.isArray(parent.value)) {
      throw yamlError(file, line, "Expected a list item.");
    }

    const match = /^([A-Za-z][A-Za-z0-9_-]*):(.*)$/.exec(line.text);
    if (!match?.[1] || match[2] === undefined) {
      throw yamlError(file, line, "Expected 'key: value'.");
    }

    const key = match[1];
    if (Object.prototype.hasOwnProperty.call(parent.value, key)) {
      throw yamlError(file, line, `Duplicate YAML key "${key}".`);
    }

    const raw = match[2].trim();
    if (raw) {
      parent.value[key] = parseScalar(raw, file, line.line);
      return;
    }

    const next = lines[index + 1];
    const child: Record<string, unknown> | unknown[] = next && next.indent > line.indent && next.text.startsWith("-") ? [] : {};
    parent.value[key] = child;
    stack.push({ indent: line.indent, value: child });
  });

  return root;
}

function toYamlLines(source: string, file: string, lineOffset: number): YamlLine[] {
  const lines: YamlLine[] = [];
  source.split(/\r?\n/).forEach((rawLine, index) => {
    if (/^\s*$/.test(rawLine)) {
      return;
    }
    if (rawLine.startsWith("\t")) {
      throw yamlError(file, { indent: 0, line: lineOffset + index, text: rawLine }, "Tabs are not allowed for indentation.");
    }

    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const text = stripYamlComment(rawLine.slice(indent)).trimEnd();
    if (!text) {
      return;
    }
    lines.push({ indent, line: lineOffset + index, text });
  });
  return lines;
}

function parseScalar(raw: string, file: string, line: number): unknown {
  if (raw === "[]") {
    return [];
  }
  if (raw.startsWith("[")) {
    return parseInlineArray(raw, file, line);
  }
  if (raw === "{}") {
    return {};
  }
  if (raw.startsWith("{") || raw.endsWith("}")) {
    throw yamlError(file, { indent: 0, line, text: raw }, "Inline objects are not supported; use indented key/value pairs.");
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  if (raw === "null" || raw === "~") {
    return null;
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) {
    return Number(raw);
  }
  if (raw.startsWith('"') || raw.endsWith('"')) {
    return parseDoubleQuoted(raw, file, line);
  }
  if (raw.startsWith("'") || raw.endsWith("'")) {
    return parseSingleQuoted(raw, file, line);
  }
  return raw;
}

function parseInlineArray(raw: string, file: string, line: number): unknown[] {
  if (!raw.startsWith("[") || !raw.endsWith("]")) {
    throw yamlError(file, { indent: 0, line, text: raw }, "Invalid inline array.");
  }

  const body = raw.slice(1, -1).trim();
  if (!body) {
    return [];
  }

  return splitInlineItems(body, file, line).map((item) => parseScalar(item, file, line));
}

function splitInlineItems(body: string, file: string, line: number): string[] {
  const items: string[] = [];
  let quote: "'" | '"' | undefined;
  let start = 0;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === ",") {
      items.push(body.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (quote) {
    throw yamlError(file, { indent: 0, line, text: body }, "Unterminated quoted string in inline array.");
  }

  items.push(body.slice(start).trim());
  if (items.some((item) => item.length === 0)) {
    throw yamlError(file, { indent: 0, line, text: body }, "Inline array contains an empty item.");
  }
  return items;
}

function parseDoubleQuoted(raw: string, file: string, line: number): string {
  if (!raw.startsWith('"') || !raw.endsWith('"')) {
    throw yamlError(file, { indent: 0, line, text: raw }, "Unterminated double-quoted string.");
  }
  try {
    return JSON.parse(raw) as string;
  } catch {
    throw yamlError(file, { indent: 0, line, text: raw }, "Invalid double-quoted string.");
  }
}

function parseSingleQuoted(raw: string, file: string, line: number): string {
  if (!raw.startsWith("'") || !raw.endsWith("'")) {
    throw yamlError(file, { indent: 0, line, text: raw }, "Unterminated single-quoted string.");
  }
  return raw.slice(1, -1).replaceAll("''", "'");
}

function stripYamlComment(text: string): string {
  let quote: "'" | '"' | undefined;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "#" && (index === 0 || /\s/.test(text[index - 1] ?? ""))) {
      return text.slice(0, index).trimEnd();
    }
  }
  return text;
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

function toLoaderIssue(file: string, issue: ValidationIssue): PiAgentLoaderIssue {
  return { file, path: issue.path, message: issue.message };
}

function yamlError(file: string, line: YamlLine, message: string): PiAgentLoaderError {
  return new PiAgentLoaderError([{ file, line: line.line, message }]);
}

function formatIssue(issue: PiAgentLoaderIssue): string {
  const location = [issue.file, issue.line, issue.path].filter((part) => part !== undefined && part !== "").join(":");
  return `${location}: ${issue.message}`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
