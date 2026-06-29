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

  it("loads .pi/agents/*.md files in deterministic order", async () => {
    await withTempRoot(async (root) => {
      await writeAgent(root, "b.md", validScout.replace("name: scout", "name: tester"));
      await writeAgent(root, "a.md", validScout);
      await writeFile(join(root, ".pi", "agents", "ignore.txt"), "not an agent");

      const agents = await loadPiAgentDefinitions(root);

      assert.deepEqual(agents.map((agent) => agent.name), ["scout", "tester"]);
    });
  });

  it("returns an empty list when .pi/agents is absent", async () => {
    await withTempRoot(async (root) => {
      assert.deepEqual(await loadPiAgentDefinitions(root), []);
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
        error.issues.some((issue) => issue.file === "bad-yaml.md" && issue.line === 1 && /Expected 'key: value'/.test(issue.message)),
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

  it("rejects YAML list item mappings instead of corrupting schemas", () => {
    assert.throws(
      () =>
        parsePiAgentMarkdown(
          `---
name: scout
description: Read-only explorer.
outputSchema:
  oneOf:
    - type: string
---
Body.
`,
          "list-mapping.md",
        ),
      /List item mappings are not supported/,
    );
  });

  it("rejects duplicate names across files", async () => {
    await withTempRoot(async (root) => {
      await writeAgent(root, "first.md", validScout);
      await writeAgent(root, "second.md", validScout.replace("description: Read-only explorer.", "description: Duplicate scout."));

      await assert.rejects(
        () => loadPiAgentDefinitions(root),
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
