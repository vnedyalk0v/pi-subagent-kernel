import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RunNotFoundError } from "../../src/registry/index.ts";
import { createSubagentToolServices, createSubagentTools } from "../../src/tools/subagent-tools.ts";

function cancelTool() {
  const services = createSubagentToolServices();
  const tool = createSubagentTools(services).find((item) => item.name === "subagent_cancel");
  assert.ok(tool);
  return { services, tool };
}

describe("subagent_cancel", () => {
  it("cancels queued runs without backend cancellation", async () => {
    const { services, tool } = cancelTool();
    services.runs.create({ id: "run_queued", agent: "scout", task: "Inspect files." });

    const result = await tool.execute("call_1", { id: "run_queued" });

    assert.equal(result.details.tool, "subagent_cancel");
    assert.equal(result.details.status, "cancelled");
    assert.equal(result.details.cancelled, true);
    assert.equal(result.details.backendCancel.called, false);
    assert.equal(result.details.run.summary, "Cancellation requested.");
  });

  it("cancels running runs and records mock backend cancellation", async () => {
    const { services, tool } = cancelTool();
    services.runs.create({ id: "run_running", agent: "tester", task: "Run tests.", runtime: "subprocess" });
    services.runs.updateState("run_running", "starting", { runtime: "subprocess" });
    services.runs.updateState("run_running", "running", { summary: "Running tests." });

    const result = await tool.execute("call_1", { id: "run_running", reason: "No longer needed." });

    assert.equal(result.details.tool, "subagent_cancel");
    assert.equal(result.details.status, "cancelled");
    assert.equal(result.details.cancelled, true);
    assert.equal(result.details.backendCancel.called, true);
    assert.equal(result.details.run.summary, "No longer needed.");
    assert.ok(result.details.run.endedAt);
  });

  it("handles completed runs safely", async () => {
    const { services, tool } = cancelTool();
    services.runs.create({ id: "run_done", agent: "scout", task: "Inspect files.", runtime: "sdk" });
    services.runs.updateState("run_done", "starting", { runtime: "sdk" });
    services.runs.updateState("run_done", "running");
    const completed = services.runs.updateState("run_done", "completed", { summary: "Done." });

    const result = await tool.execute("call_1", { id: "run_done", reason: "Too late." });

    assert.equal(result.details.tool, "subagent_cancel");
    assert.equal(result.details.status, "completed");
    assert.equal(result.details.cancelled, false);
    assert.equal(result.details.backendCancel.called, false);
    assert.equal(result.details.run.endedAt, completed.endedAt);
  });

  it("handles missing runs clearly", async () => {
    const { tool } = cancelTool();

    await assert.rejects(
      () => tool.execute("call_1", {}),
      /id is required and must be a string/,
    );
    await assert.rejects(
      () => tool.execute("call_1", { id: "run_missing" }),
      (error) => error instanceof RunNotFoundError && /Unknown run ID "run_missing"/.test(error.message),
    );
  });
});
