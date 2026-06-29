import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRunEnvelope } from "../../src/contracts/index.ts";
import { createSubagentTools, SubagentToolValidationError } from "../../src/tools/subagent-tools.ts";

function spawnTool() {
  const tool = createSubagentTools().find((item) => item.name === "subagent_spawn");
  assert.ok(tool);
  return tool;
}

describe("subagent_spawn", () => {
  it("returns a valid RunEnvelope for foreground mock runs", async () => {
    const result = await spawnTool().execute("call_1", {
      agent: "scout",
      task: "Inspect README.md",
      mode: "foreground",
      context: { inherit: "summary", files: ["README.md"] },
      limits: { maxCostUsd: 0.25 },
    });

    assert.equal(result.details.tool, "subagent_spawn");
    assert.equal(result.details.mode, "foreground");
    assert.equal(result.details.mock, true);
    assert.equal(result.details.policy.maxDepth, 1);
    assert.equal(result.details.policy.nestedSubagents, false);
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
      () => spawnTool().execute("call_1", { agent: "scout", task: "Do work.", context: { inherit: "full" } }),
      /context\.mode full requires explicit policy approval/,
    );
  });
});
