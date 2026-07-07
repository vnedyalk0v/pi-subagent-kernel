import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ClaudeAgentLoaderError, loadClaudeAgentDefinitions, parseClaudeAgentMarkdown } from "../../src/index.ts";

const validClaudeReviewer = `---
name: claude_reviewer
description: Reviews code using Claude-style metadata.
tools: Read, Grep, Glob
model: claude-sonnet-4
skills:
  - review
---
Review the change and return actionable findings.
`;

describe("Claude agent importer", () => {
  it("maps supported Claude frontmatter fields into AgentDefinition", () => {
    const result = parseClaudeAgentMarkdown(validClaudeReviewer, "reviewer.md");

    assert.equal(result.definition.name, "claude_reviewer");
    assert.equal(result.definition.description, "Reviews code using Claude-style metadata.");
    assert.equal(result.definition.instructions, "Review the change and return actionable findings.");
    assert.deepEqual(result.definition.tools, ["read", "grep", "find"]);
    assert.equal(result.definition.model, "claude-sonnet-4");
    assert.deepEqual(result.definition.skills, ["review"]);
    assert.equal(result.definition.compat?.source, "claude");
    assert.equal(result.definition.compat?.sourcePath, "reviewer.md");
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0]?.message ?? "", /Glob maps to Pi find/);
  });

  it("warns instead of inheriting all tools when Claude tools are omitted", () => {
    const result = parseClaudeAgentMarkdown(
      `---
name: scout
description: Scout imported from Claude.
---
Gather evidence.
`,
      "scout.md",
    );

    assert.deepEqual(result.definition.tools, []);
    assert.equal((result.definition.compat?.claude as { inheritedTools?: boolean }).inheritedTools, true);
    assert.match(result.warnings[0]?.message ?? "", /empty allowlist/);
  });

  it("preserves unsupported Claude fields as compatibility metadata with warnings", () => {
    const result = parseClaudeAgentMarkdown(
      `---
name: hooked_reviewer
description: Has Claude-only behavior.
tools: [Read]
hooks:
  PreToolUse:
    - echo nope
isolation: worktree
---
Review safely.
`,
      "hooked.md",
    );

    const claudeCompat = result.definition.compat?.claude as { unsupported?: Record<string, unknown> };
    assert.deepEqual(Object.keys(claudeCompat.unsupported ?? {}).sort(), ["hooks", "isolation"]);
    assert.equal(result.warnings.length, 2);
    assert.ok(result.warnings.every((warning) => /not executed|preserved/.test(warning.message)));
  });

  it("imports MCP server requests without enabling them silently", () => {
    const result = parseClaudeAgentMarkdown(
      `---
name: mcp_reviewer
description: Requests a docs MCP server.
tools: [Read]
mcpServers:
  docs: {}
---
Review with docs if policy allows it.
`,
      "mcp.md",
    );

    assert.deepEqual(result.definition.sandbox.mcpServers, ["docs"]);
    assert.ok(result.warnings.some((warning) => /explicit MCP allowlist/.test(warning.message)));
  });

  it("rejects invalid supported fields with loader issues", () => {
    assert.throws(
      () =>
        parseClaudeAgentMarkdown(
          `---
name: Bad Name
description: Invalid name.
tools: "*"
---
Body.
`,
          "bad.md",
        ),
      (error) =>
        error instanceof ClaudeAgentLoaderError &&
        error.issues.some((issue) => issue.path === "name" && /Name must match/.test(issue.message)) &&
        error.issues.some((issue) => issue.path === "tools[0]" && /Wildcard/.test(issue.message)),
    );
  });

  it("loads .claude/agents/*.md files in deterministic order", async () => {
    await withTempRoot(async (root) => {
      await writeAgent(root, "b.md", validClaudeReviewer.replace("claude_reviewer", "z_reviewer"));
      await writeAgent(root, "a.md", validClaudeReviewer);
      await writeFile(join(root, ".claude", "agents", "ignore.txt"), "not an agent");

      const results = await loadClaudeAgentDefinitions(root, { trusted: true });

      assert.deepEqual(results.map((result) => result.definition.name), ["claude_reviewer", "z_reviewer"]);
    });
  });

  it("requires trust before importing project Claude agent files", async () => {
    await withTempRoot(async (root) => {
      await writeAgent(root, "reviewer.md", validClaudeReviewer);

      await assert.rejects(
        () => loadClaudeAgentDefinitions(root),
        /Project-local Claude agent definitions require trusted: true/,
      );
    });
  });

  it("rejects duplicate imported Claude agent names", async () => {
    await withTempRoot(async (root) => {
      await writeAgent(root, "first.md", validClaudeReviewer);
      await writeAgent(root, "second.md", validClaudeReviewer.replace("Reviews code", "Also reviews code"));

      await assert.rejects(
        () => loadClaudeAgentDefinitions(root, { trusted: true }),
        (error) =>
          error instanceof ClaudeAgentLoaderError &&
          error.issues.some(
            (issue) => issue.path === "name" && /Duplicate agent name "claude_reviewer"; first seen in/.test(issue.message),
          ),
      );
    });
  });
});

async function withTempRoot(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "claude-agent-loader-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeAgent(root: string, fileName: string, source: string): Promise<void> {
  const agentsDir = join(root, ".claude", "agents");
  await mkdir(agentsDir, { recursive: true });
  await writeFile(join(agentsDir, fileName), source);
}
