import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AgentDefinitionValidationError,
  parseAgentDefinition,
  parseAgentDefinitions,
  validateAgentDefinition,
} from "../../src/contracts/agent-definition.ts";

const validDefinition = {
  name: "scout",
  description: "Read-only explorer.",
  instructions: "Gather evidence only.",
  runtime: "sdk",
};

describe("AgentDefinition", () => {
  it("normalizes safe defaults", () => {
    const definition = parseAgentDefinition({
      name: "reviewer",
      description: "Reviews diffs.",
      instructions: "Find real bugs.",
    });

    assert.equal(definition.runtime, "auto");
    assert.deepEqual(definition.tools, []);
    assert.deepEqual(definition.skills, []);
    assert.equal(definition.model, "inherit");
    assert.equal(definition.inheritContext, "summary");
    assert.equal(definition.nestedSubagents, false);
    assert.deepEqual(definition.sandbox, {
      filesystem: "read-only",
      network: "none",
      shell: "none",
      mcpServers: [],
      childExtensions: "deny-by-default",
    });
  });

  it("accepts documented scout fields", () => {
    const definition = parseAgentDefinition({
      name: "scout",
      description: "Read-only codebase explorer.",
      instructions: "Do not edit files.",
      runtime: "sdk",
      model: "inherit",
      thinking: "low",
      tools: ["read", "grep", "find", "ls"],
      permissions: {
        filesystem: "read-only",
        network: "none",
        shell: "none",
      },
      context: { inherit: "summary" },
      limits: {
        maxRuntimeSec: 900,
        maxTurns: 8,
        maxCostUsd: 0.25,
      },
      outputSchema: "research_notes_v1",
    });

    assert.equal(definition.name, "scout");
    assert.equal(definition.runtime, "sdk");
    assert.deepEqual(definition.tools, ["read", "grep", "find", "ls"]);
    assert.equal(definition.maxRuntimeSec, 900);
    assert.equal(definition.outputSchema, "research_notes_v1");
  });

  it("rejects missing name", () => {
    const result = validateAgentDefinition({
      description: "No name.",
      instructions: "No name.",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.issues.map((issue) => issue.path), ["name"]);
      assert.match(result.issues[0].message, /required/);
    }
  });

  it("rejects missing description", () => {
    assert.throws(
      () => parseAgentDefinition({ name: "scout", instructions: "No description." }),
      (error) =>
        error instanceof AgentDefinitionValidationError &&
        error.issues.some((issue) => issue.path === "description" && /required/.test(issue.message)),
    );
  });

  it("rejects invalid runtime", () => {
    assert.throws(
      () => parseAgentDefinition({ ...validDefinition, runtime: "browser" }),
      /runtime must be one of: sdk, subprocess, worktree, mux, remote, auto/,
    );
  });

  it("rejects duplicate names", () => {
    assert.throws(
      () =>
        parseAgentDefinitions([
          validDefinition,
          { ...validDefinition, description: "Duplicate scout." },
        ]),
      /Duplicate agent name "scout"; first seen at \[0\]\.name/,
    );
  });

  it("rejects unsafe wildcard allowlists", () => {
    assert.throws(
      () => parseAgentDefinition({ ...validDefinition, tools: ["*"] }),
      /Wildcard allowlists are not allowed/,
    );
  });
});
