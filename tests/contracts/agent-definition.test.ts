import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AGENT_DEFINITION_DEFAULTS,
  FILESYSTEM_POLICIES,
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
    assert.equal(definition.maxDepth, 1);
    assert.equal(definition.maxThreads, 4);
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
      context: {
        inherit: "summary",
        includeFiles: ["*", "src/**/*.ts"],
        excludeFiles: ["**/node_modules/**"],
        parentSummaryMaxTokens: 1200,
        attachRecentDiff: true,
      },
      limits: {
        maxRuntimeSec: 900,
        maxTurns: 8,
        maxCostUsd: 0.25,
        maxInputTokens: 50000,
        maxOutputTokens: 8000,
        maxDepth: 1,
        maxThreads: 2,
      },
      mcpServers: { docs: {} },
      outputSchema: "research_notes_v1",
      resultMode: "json",
      tags: ["builtin", "read-only"],
    });

    assert.equal(definition.name, "scout");
    assert.equal(definition.runtime, "sdk");
    assert.deepEqual(definition.tools, ["read", "grep", "find", "ls"]);
    assert.equal(definition.maxRuntimeSec, 900);
    assert.equal(definition.maxInputTokens, 50000);
    assert.equal(definition.maxOutputTokens, 8000);
    assert.equal(definition.maxDepth, 1);
    assert.equal(definition.maxThreads, 2);
    assert.deepEqual(definition.includeFiles, ["*", "src/**/*.ts"]);
    assert.deepEqual(definition.excludeFiles, ["**/node_modules/**"]);
    assert.equal(definition.parentSummaryMaxTokens, 1200);
    assert.equal(definition.attachRecentDiff, true);
    assert.deepEqual(definition.sandbox.mcpServers, ["docs"]);
    assert.equal(definition.outputSchema, "research_notes_v1");
    assert.equal(definition.resultMode, "json");
    assert.deepEqual(definition.tags, ["builtin", "read-only"]);
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

  it("rejects reserved tool names", () => {
    assert.throws(() => parseAgentDefinition({ ...validDefinition, name: "subagent_spawn" }), /reserved for a subagent tool/);
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

  it("rejects unresolved mcp wildcards", () => {
    assert.throws(
      () => parseAgentDefinition({ ...validDefinition, mcpServers: ["mcp:*"] }),
      /Wildcard allowlists are not allowed/,
    );
  });

  it("rejects unknown fields", () => {
    assert.throws(
      () => parseAgentDefinition({ ...validDefinition, permissions: { filesystems: "read-only" } }),
      /permissions\.filesystems: Unknown field "filesystems"/,
    );
  });

  it("rejects full context from agent definitions", () => {
    assert.throws(
      () => parseAgentDefinition({ ...validDefinition, context: { inherit: "full" } }),
      /inheritContext full requires spawn-time policy approval/,
    );
  });

  it("rejects shadowed full context aliases", () => {
    assert.throws(
      () => parseAgentDefinition({ ...validDefinition, inheritContext: "summary", context: { inherit: "full" } }),
      /inheritContext full requires spawn-time policy approval/,
    );
  });

  it("rejects fractional count limits", () => {
    assert.throws(() => parseAgentDefinition({ ...validDefinition, maxTurns: 0.5 }), /maxTurns must be a positive integer/);
  });

  it("rejects explicit null limits", () => {
    assert.throws(() => parseAgentDefinition({ ...validDefinition, maxTurns: null }), /maxTurns must be a positive integer/);
  });

  it("rejects explicit null nested limit aliases", () => {
    assert.throws(
      () => parseAgentDefinition({ ...validDefinition, maxTurns: 3, limits: { maxTurns: null } }),
      /limits\.maxTurns must be a positive integer/,
    );
  });

  it("rejects explicit null nested mcp allowlists", () => {
    assert.throws(
      () => parseAgentDefinition({ ...validDefinition, permissions: { mcpServers: null } }),
      /permissions\.mcpServers must be an array of strings/,
    );
  });

  it("rejects malformed shadowed permissions", () => {
    assert.throws(
      () =>
        parseAgentDefinition({
          ...validDefinition,
          permissions: { filesystem: null },
          sandbox: { filesystem: "read-only" },
        }),
      /permissions\.filesystem must be one of/,
    );
  });

  it("freezes exported default allowlists", () => {
    assert.throws(() => (AGENT_DEFINITION_DEFAULTS.tools as string[]).push("bash"), TypeError);
  });

  it("freezes exported policy enums", () => {
    assert.throws(() => (FILESYSTEM_POLICIES as unknown as string[]).push("allow-everything"), TypeError);
  });
});
