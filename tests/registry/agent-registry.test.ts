import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AgentDefinitionValidationError, AgentRegistry, DuplicateAgentNameError } from "../../src/index.ts";

const scout = {
  name: "scout",
  description: "Read-only explorer.",
  instructions: "Gather evidence only.",
};

const reviewer = {
  name: "reviewer",
  description: "Reviews diffs.",
  instructions: "Find real bugs.",
};

describe("AgentRegistry", () => {
  it("registers and retrieves definitions by name", () => {
    const registry = new AgentRegistry();
    const registered = registry.register(scout);

    assert.equal(registry.get("scout"), registered);
    assert.equal(registry.get("SCOUT"), registered);
    assert.equal(registry.get(" missing "), undefined);
  });

  it("lists registered definitions in registration order", () => {
    const registry = new AgentRegistry();
    registry.register(scout);
    registry.register(reviewer);

    const listed = registry.list();

    assert.deepEqual(listed.map((agent) => agent.name), ["scout", "reviewer"]);
    listed.pop();
    assert.equal(registry.list().length, 2);
  });

  it("rejects duplicate names", () => {
    const registry = new AgentRegistry();
    registry.register(scout);

    assert.throws(
      () => registry.register({ ...scout, description: "Duplicate scout." }),
      (error) =>
        error instanceof DuplicateAgentNameError &&
        error.agentName === "scout" &&
        /Duplicate agent name "scout"/.test(error.message),
    );
  });

  it("validates definitions before registration", () => {
    const registry = new AgentRegistry();

    assert.throws(
      () => registry.register({ ...scout, name: "Bad Name" }),
      (error) =>
        error instanceof AgentDefinitionValidationError &&
        error.issues.some((issue) => issue.path === "name" && /Name must match/.test(issue.message)),
    );
    assert.equal(registry.list().length, 0);
  });
});
