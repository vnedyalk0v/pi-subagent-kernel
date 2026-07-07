import { LineCounter, parseDocument } from "yaml";

export interface MarkdownAgentIssue {
  file: string;
  message: string;
  line?: number;
  path?: string;
}

export class MarkdownAgentParseError extends Error {
  readonly issues: MarkdownAgentIssue[];

  constructor(issues: MarkdownAgentIssue[]) {
    super(`Invalid Markdown agent definition: ${issues.map(formatIssue).join("; ")}`);
    this.name = "MarkdownAgentParseError";
    this.issues = issues;
  }
}

export function parseMarkdownAgentDocument(source: string, file = "<agent>"): { frontmatter: Record<string, unknown>; body: string } {
  const parts = splitFrontmatter(source, file);
  return {
    frontmatter: parseYamlObject(parts.frontmatter, file, 2),
    body: parts.body,
  };
}

function splitFrontmatter(source: string, file: string): { frontmatter: string; body: string } {
  const text = source.startsWith("\uFEFF") ? source.slice(1) : source;
  const lines = text.split(/\r?\n/);

  if (lines[0] !== "---") {
    throw new MarkdownAgentParseError([{ file, line: 1, message: "Missing YAML frontmatter delimiter '---'." }]);
  }

  const end = lines.findIndex((line, index) => index > 0 && line === "---");
  if (end === -1) {
    throw new MarkdownAgentParseError([{ file, line: 1, message: "Missing closing YAML frontmatter delimiter '---'." }]);
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
    stringKeys: true,
    uniqueKeys: true,
  });
  const issues = [...document.errors, ...document.warnings].map((error) => toYamlIssue(file, error, lineOffset));

  if (issues.length > 0) {
    throw new MarkdownAgentParseError(issues);
  }

  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new MarkdownAgentParseError([{ file, message: error instanceof Error ? error.message : String(error) }]);
  }

  const plain = readPlainYamlValue(value, file, "$");
  if (!isRecord(plain)) {
    throw new MarkdownAgentParseError([{ file, line: lineOffset, message: "YAML frontmatter must be an object." }]);
  }

  return plain;
}

function readPlainYamlValue(value: unknown, file: string, path: string): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => readPlainYamlValue(item, file, `${path}[${index}]`));
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new MarkdownAgentParseError([{ file, path, message: "YAML value must be a plain object, array, or scalar." }]);
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, readPlainYamlValue(item, file, `${path}.${key}`)]),
  );
}

function toYamlIssue(file: string, error: { message: string; linePos?: Array<{ line: number }> }, lineOffset: number): MarkdownAgentIssue {
  const position = error.linePos?.[0];
  return {
    file,
    ...(position ? { line: lineOffset + position.line - 1 } : {}),
    message: error.message,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatIssue(issue: MarkdownAgentIssue): string {
  const location = [issue.file, issue.line, issue.path].filter((part) => part !== undefined && part !== "").join(":");
  return `${location}: ${issue.message}`;
}
