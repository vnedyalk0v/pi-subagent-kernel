import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgentRegistry, BUILT_IN_AGENT_DEFINITIONS, registerBuiltInAgents, type AgentDefinition } from "../../src/index.ts";

const expectedBuiltIns = ["scout", "reviewer", "tester", "summarizer"];
const forbiddenWriteTools = new Set(["bash", "edit", "write"]);

describe("built-in agent definitions", () => {
  it("exports only the MVP-safe built-in agents", () => {
    const names = BUILT_IN_AGENT_DEFINITIONS.map((agent) => agent.name);

    assert.deepEqual(names, expectedBuiltIns);
    assert.equal(names.includes("implementer"), false);
  });

  it("uses narrow tools and safe default policies", () => {
    const byName = new Map(BUILT_IN_AGENT_DEFINITIONS.map((agent) => [agent.name, agent]));

    assert.deepEqual(byName.get("scout")?.tools, ["read", "grep", "find", "ls"]);
    assert.deepEqual(byName.get("reviewer")?.tools, ["read", "grep", "find", "ls", "bash:test-only"]);
    assert.deepEqual(byName.get("tester")?.tools, ["read", "grep", "find", "ls", "bash:test-only"]);
    assert.deepEqual(byName.get("summarizer")?.tools, []);

    for (const agent of BUILT_IN_AGENT_DEFINITIONS) {
      assert.equal(agent.sandbox.network, "none");
      assert.equal(agent.sandbox.childExtensions, "deny-by-default");
      assert.deepEqual(agent.sandbox.mcpServers, []);
      assert.equal(agent.nestedSubagents, false);
      assert.equal(agent.maxDepth, 1);
      assert.equal(agent.maxThreads, 4);
      assert.equal(agent.tools.some((tool) => forbiddenWriteTools.has(tool)), false);
    }

    assert.equal(byName.get("scout")?.sandbox.filesystem, "read-only");
    assert.equal(byName.get("scout")?.sandbox.shell, "none");
    assert.equal(byName.get("reviewer")?.sandbox.filesystem, "read-only");
    assert.equal(byName.get("reviewer")?.sandbox.shell, "test-only");
    assert.equal(byName.get("tester")?.sandbox.filesystem, "read-only");
    assert.equal(byName.get("tester")?.sandbox.shell, "test-only");
    assert.equal(byName.get("summarizer")?.sandbox.filesystem, "none");
    assert.equal(byName.get("summarizer")?.sandbox.shell, "none");
  });

  it("registers in the existing AgentRegistry", () => {
    const registry = new AgentRegistry();
    const registered = registerBuiltInAgents(registry);

    assert.deepEqual(registered.map((agent) => agent.name), expectedBuiltIns);
    assert.deepEqual(registry.list().map((agent) => agent.name), expectedBuiltIns);
    assert.equal(registry.get("REVIEWER")?.outputSchema, "review_findings_v1");
  });

  it("preserves existing higher-priority registry entries", () => {
    const registry = new AgentRegistry();
    const projectTester = registry.register({
      name: "tester",
      description: "Project-specific tester.",
      instructions: "Use project validation rules.",
    });

    const registered = registerBuiltInAgents(registry);

    assert.deepEqual(registered.map((agent) => agent.name), ["scout", "reviewer", "summarizer"]);
    assert.equal(registry.get("tester"), projectTester);
    assert.deepEqual(registry.list().map((agent) => agent.name), ["tester", "scout", "reviewer", "summarizer"]);
  });

  it("freezes the exported definitions", () => {
    assert.throws(
      () => (BUILT_IN_AGENT_DEFINITIONS as AgentDefinition[]).push(BUILT_IN_AGENT_DEFINITIONS[0]!),
      TypeError,
    );
    assert.throws(() => (BUILT_IN_AGENT_DEFINITIONS[0]!.tools as string[]).push("write"), TypeError);
  });
});
