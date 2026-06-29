import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { loadPiAgentDefinitions, parsePiAgentMarkdown, PiAgentLoaderError } from "../../src/index.ts";

const validScout = `---
name: scout
description: Read-only explorer.
runtime: sdk
tools: [read, grep, find, ls]
permissions:
  filesystem: read-only
  network: none
context:
  inherit: summary
limits:
  maxRuntimeSec: 900
outputSchema: research_notes_v1
---
Gather evidence only.
`;

describe("Pi agent loader", () => {
  it("parses a valid Markdown agent definition", () => {
    const agent = parsePiAgentMarkdown(validScout, "scout.md");

    assert.equal(agent.name, "scout");
    assert.equal(agent.description, "Read-only explorer.");
    assert.equal(agent.instructions, "Gather evidence only.");
    assert.equal(agent.runtime, "sdk");
    assert.deepEqual(agent.tools, ["read", "grep", "find", "ls"]);
    assert.equal(agent.sandbox.filesystem, "read-only");
    assert.equal(agent.sandbox.network, "none");
    assert.equal(agent.inheritContext, "summary");
    assert.equal(agent.maxRuntimeSec, 900);
    assert.equal(agent.outputSchema, "research_notes_v1");
  });

  it("preserves plain scalars with bracket, quote, or brace suffixes", () => {
    const agent = parsePiAgentMarkdown(
      `---
name: scout
description: Reviews "security"
context:
  includeFiles:
    - app/[locale]
tags:
  - expands ${"${VAR}"}
---
Gather evidence only.
`,
      "plain-scalars.md",
    );

    assert.equal(agent.description, 'Reviews "security"');
    assert.deepEqual(agent.includeFiles, ["app/[locale]"]);
    assert.deepEqual(agent.tags, ["expands ${VAR}"]);
  });

  it("loads .pi/agents/*.md files in deterministic order", async () => {
    await withTempRoot(async (root) => {
      await writeAgent(root, "b.md", validScout.replace("name: scout", "name: tester"));
      await writeAgent(root, "a.md", validScout);
      await writeFile(join(root, ".pi", "agents", "ignore.txt"), "not an agent");

      const agents = await loadPiAgentDefinitions(root, { trusted: true });

      assert.deepEqual(agents.map((agent) => agent.name), ["scout", "tester"]);
    });
  });

  it("returns an empty list when .pi/agents is absent", async () => {
    await withTempRoot(async (root) => {
      assert.deepEqual(await loadPiAgentDefinitions(root), []);
    });
  });

  it("requires trust before loading project agent files", async () => {
    await withTempRoot(async (root) => {
      await writeAgent(root, "scout.md", validScout);

      await assert.rejects(
        () => loadPiAgentDefinitions(root),
        /Project-local agent definitions require trusted: true/,
      );
    });
  });

  it("rejects missing frontmatter", () => {
    assert.throws(
      () => parsePiAgentMarkdown("name: scout\n", "bad.md"),
      (error) =>
        error instanceof PiAgentLoaderError &&
        error.issues.some((issue) => issue.file === "bad.md" && issue.line === 1 && /Missing YAML frontmatter/.test(issue.message)),
    );
  });

  it("rejects invalid YAML", () => {
    assert.throws(
      () =>
        parsePiAgentMarkdown(
          `---
name scout
description: Broken.
---
Body.
`,
          "bad-yaml.md",
        ),
      (error) =>
        error instanceof PiAgentLoaderError &&
        error.issues.some((issue) => issue.file === "bad-yaml.md" && issue.line === 2 && /Implicit keys/.test(issue.message)),
    );
  });

  it("rejects missing required fields", () => {
    assert.throws(
      () =>
        parsePiAgentMarkdown(
          `---
name: scout
---
Body.
`,
          "missing-description.md",
        ),
      (error) =>
        error instanceof PiAgentLoaderError &&
        error.issues.some(
          (issue) => issue.file === "missing-description.md" && issue.path === "description" && /required/.test(issue.message),
        ),
    );
  });

  it("preserves YAML list item mappings in inline schemas", () => {
    const agent = parsePiAgentMarkdown(
      `---
name: scout
description: Read-only explorer.
outputSchema:
  oneOf:
    - enum:
      - safe
---
Body.
`,
      "list-mapping.md",
    );

    assert.deepEqual(agent.outputSchema, { oneOf: [{ enum: ["safe"] }] });
  });

  it("rejects YAML tags that produce non-plain objects", () => {
    assert.throws(
      () =>
        parsePiAgentMarkdown(
          `---
name: scout
description: Read-only explorer.
outputSchema: !!timestamp 2026-06-29
---
Body.
`,
          "tagged-object.md",
        ),
      /YAML value must be a plain object/,
    );
  });

  it("rejects non-scalar YAML mapping keys", () => {
    assert.throws(
      () =>
        parsePiAgentMarkdown(
          `---
name: scout
description: Read-only explorer.
outputSchema:
  ? [type]
  : string
---
Body.
`,
          "complex-key.md",
        ),
      /keys/i,
    );
  });

  it("rejects empty values instead of inventing objects", () => {
    assert.throws(
      () =>
        parsePiAgentMarkdown(
          `---
name: scout
description: Read-only explorer.
outputSchema:
---
Body.
`,
          "empty-value.md",
        ),
      /outputSchema must be a string or object/,
    );
  });

  it("rejects inconsistent nested indentation", () => {
    assert.throws(
      () =>
        parsePiAgentMarkdown(
          `---
name: scout
description: Read-only explorer.
tools:
    - read
  - grep
---
Body.
`,
          "bad-indent.md",
        ),
      /Implicit|block sequence|indent/i,
    );
  });

  it("rejects duplicate names across files", async () => {
    await withTempRoot(async (root) => {
      await writeAgent(root, "first.md", validScout);
      await writeAgent(root, "second.md", validScout.replace("description: Read-only explorer.", "description: Duplicate scout."));

      await assert.rejects(
        () => loadPiAgentDefinitions(root, { trusted: true }),
        (error) =>
          error instanceof PiAgentLoaderError &&
          error.issues.some(
            (issue) => issue.path === "name" && /Duplicate agent name "scout"; first seen in/.test(issue.message),
          ),
      );
    });
  });
});

async function withTempRoot(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "pi-agent-loader-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeAgent(root: string, fileName: string, source: string): Promise<void> {
  const agentsDir = join(root, ".pi", "agents");
  await mkdir(agentsDir, { recursive: true });
  await writeFile(join(agentsDir, fileName), source);
}
