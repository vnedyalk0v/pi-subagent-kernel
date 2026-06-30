import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRunEnvelope } from "../../src/contracts/index.ts";
import { AgentRegistry, RunRegistry } from "../../src/registry/index.ts";
import { createSubagentTools, SubagentToolValidationError } from "../../src/tools/subagent-tools.ts";

function spawnTool() {
  const tool = createSubagentTools().find((item) => item.name === "subagent_spawn");
  assert.ok(tool);
  return tool;
}

function toolForAgent(agent: unknown) {
  const agents = new AgentRegistry();
  agents.register(agent);
  const services = { agents, runs: new RunRegistry() };
  const tool = createSubagentTools(services)[0];
  assert.ok(tool);
  assert.equal(tool.name, "subagent_spawn");
  return { services, tool };
}

describe("subagent_spawn", () => {
  it("returns a valid RunEnvelope for foreground mock runs", async () => {
    const result = await spawnTool().execute("call_1", {
      agent: "scout",
      task: "Inspect README.md",
      mode: "foreground",
      context: { inherit: "summary", files: ["README.md"] },
      limits: { maxRuntimeSec: 999999, maxCostUsd: 1 },
    });

    assert.equal(result.details.tool, "subagent_spawn");
    assert.equal(result.details.mode, "foreground");
    assert.equal(result.details.mock, true);
    assert.equal(result.details.policy.maxDepth, 1);
    assert.equal(result.details.policy.nestedSubagents, false);
    assert.equal(result.details.limits.maxRuntimeSec, 900);
    assert.equal(result.details.limits.maxCostUsd, 0.25);
    assert.equal(result.details.status, "completed");
    assert.ok(result.details.result);

    const envelope = parseRunEnvelope(result.details.result);
    assert.equal(envelope.agent, "scout");
    assert.equal(envelope.runtime, "sdk");
    assert.equal(envelope.status, "completed");
    assert.equal(envelope.contextMode, "summary");
    assert.deepEqual(envelope.filesRead, ["README.md"]);
    assert.deepEqual(envelope.filesChanged, []);
  });

  it("returns a run ID for background mock runs", async () => {
    const result = await spawnTool().execute("call_1", {
      agent: "reviewer",
      task: "Review the current diff.",
      mode: "background",
    });

    assert.equal(result.details.tool, "subagent_spawn");
    assert.equal(result.details.mode, "background");
    assert.equal(result.details.mock, true);
    assert.match(result.details.id, /^run_/);
    assert.equal(result.details.run.agent, "reviewer");
    assert.equal(result.details.run.runtime, "subprocess");
    assert.equal(result.details.status, "completed");
    assert.equal(result.details.result, undefined);
  });

  it("rejects unknown agents with available names", async () => {
    await assert.rejects(
      () => spawnTool().execute("call_1", { agent: "missing", task: "Do work." }),
      (error) => error instanceof SubagentToolValidationError && /Available agents: scout, reviewer, tester, summarizer/.test(error.message),
    );
  });

  it("clips custom-agent limits to global policy caps", async () => {
    const agents = new AgentRegistry();
    agents.register({
      name: "oversized",
      description: "Agent with intentionally oversized limits.",
      instructions: "Return a mock result.",
      runtime: "sdk",
      limits: { maxRuntimeSec: 999999, maxCostUsd: 999 },
      context: { inherit: "summary" },
    });
    const tool = createSubagentTools({ agents, runs: new RunRegistry() })[0];

    const result = await tool.execute("call_1", {
      agent: "oversized",
      task: "Do work.",
      limits: { maxRuntimeSec: 999999, maxCostUsd: 999 },
    });

    assert.equal(result.details.tool, "subagent_spawn");
    assert.equal(result.details.limits.maxRuntimeSec, 1800);
    assert.equal(result.details.limits.maxCostUsd, 1);
  });

  it("caps spawn policy depth and thread defaults before backend runs", async () => {
    const { tool } = toolForAgent({
      name: "wide",
      description: "Agent requesting oversized fanout caps.",
      instructions: "Return a mock result.",
      runtime: "sdk",
      tools: ["read"],
      permissions: { filesystem: "read-only", network: "none", shell: "none" },
      limits: { maxDepth: 99, maxThreads: 99 },
    });

    const result = await tool.execute("call_1", { agent: "wide", task: "Inspect README.md" });

    assert.equal(result.details.tool, "subagent_spawn");
    assert.equal(result.details.policy.maxDepth, 1);
    assert.equal(result.details.policy.maxThreads, 4);
    assert.equal(result.details.policy.nestedSubagents, false);
  });

  it("enforces maxThreads before starting the backend", async () => {
    const { services, tool } = toolForAgent({
      name: "scoutish",
      description: "Read-only scout.",
      instructions: "Return a mock result.",
      runtime: "sdk",
      tools: ["read"],
      permissions: { filesystem: "read-only", network: "none", shell: "none" },
    });
    for (let index = 0; index < 4; index += 1) {
      services.runs.create({ id: `run_active_${index}`, agent: "scoutish", task: "Queued." });
    }

    await assert.rejects(
      () => tool.execute("call_1", { agent: "scoutish", task: "Inspect README.md" }),
      (error) => error instanceof SubagentToolValidationError && /maxThreads=4/.test(error.message),
    );
    assert.equal(services.runs.list().length, 4);
  });

  it("rejects unsafe tool allowlists before starting the backend", async () => {
    const { services, tool } = toolForAgent({
      name: "writer",
      description: "Unsafe writer.",
      instructions: "Write files.",
      runtime: "sdk",
      tools: ["write"],
      permissions: { filesystem: "read-only", network: "none", shell: "none" },
    });

    await assert.rejects(
      () => tool.execute("call_1", { agent: "writer", task: "Edit a file." }),
      (error) => error instanceof SubagentToolValidationError && /write tool "write" is denied/.test(error.message),
    );
    assert.equal(services.runs.list().length, 0);
  });

  it("rejects nested subagents by default", async () => {
    const { tool } = toolForAgent({
      name: "coordinator",
      description: "Nested coordinator.",
      instructions: "Spawn children.",
      runtime: "sdk",
      tools: ["subagent_spawn"],
      nestedSubagents: true,
      limits: { maxDepth: 2 },
    });

    await assert.rejects(
      () => tool.execute("call_1", { agent: "coordinator", task: "Spawn a child." }),
      (error) => error instanceof SubagentToolValidationError && /nestedSubagents/.test(error.message),
    );
  });

  it("rejects unsafe runtime and tool combinations", async () => {
    const { tool } = toolForAgent({
      name: "sdk-tester",
      description: "SDK agent requesting shell.",
      instructions: "Run tests.",
      runtime: "sdk",
      tools: ["bash:test-only"],
      permissions: { filesystem: "read-only", network: "none", shell: "test-only" },
    });

    await assert.rejects(
      () => tool.execute("call_1", { agent: "sdk-tester", task: "Run npm test." }),
      (error) => error instanceof SubagentToolValidationError && /requires subprocess runtime/.test(error.message),
    );
  });

  it("rejects unsafe sandbox policy requests", async () => {
    const { tool } = toolForAgent({
      name: "online",
      description: "Networked agent.",
      instructions: "Fetch docs.",
      runtime: "sdk",
      tools: ["read"],
      permissions: { filesystem: "read-only", network: "allow", shell: "none" },
    });

    await assert.rejects(
      () => tool.execute("call_1", { agent: "online", task: "Fetch docs." }),
      (error) => error instanceof SubagentToolValidationError && /network access requires explicit policy/.test(error.message),
    );
  });

  it("rejects invalid or unsupported spawn input", async () => {
    await assert.rejects(
      () => spawnTool().execute("call_1", { agent: "scout", task: "Do work.", extra: true }),
      /Unknown field "extra"/,
    );
    await assert.rejects(
      () => spawnTool().execute("call_1", { tasks: [{ agent: "scout", task: "Do work." }] }),
      /Unknown field "tasks"/,
    );
    await assert.rejects(
      () => spawnTool().execute("call_1", { agent: "scout", task: "Do work.", limits: { maxRuntimeSec: 0.5 } }),
      /limits\.maxRuntimeSec must be a positive integer/,
    );
    await assert.rejects(
      () => spawnTool().execute("call_1", { agent: "scout", task: "Do work.", runtime: "remote" }),
      /runtime override "remote" is not available/,
    );
    await assert.rejects(
      () => spawnTool().execute("call_1", { agent: "scout", task: "Do work.", context: { inherit: "full" } }),
      /context\.mode full requires explicit policy approval/,
    );
  });
});
