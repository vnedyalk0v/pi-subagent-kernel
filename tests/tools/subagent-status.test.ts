import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSubagentToolServices, createSubagentTools, SubagentToolValidationError } from "../../src/tools/subagent-tools.ts";

function statusTool() {
  const services = createSubagentToolServices();
  const tool = createSubagentTools(services).find((item) => item.name === "subagent_status");
  assert.ok(tool);
  return { services, tool };
}

describe("subagent_status", () => {
  it("returns structured status for an existing queued run", async () => {
    const { services, tool } = statusTool();
    services.runs.create({ id: "run_queued", agent: "scout", task: "Inspect files.", summary: "Waiting for backend." });

    const result = await tool.execute("call_1", { id: "run_queued" });

    assert.equal(result.details.tool, "subagent_status");
    assert.equal(result.details.status, "queued");
    assert.equal(result.details.id, "run_queued");
    assert.equal(result.details.run.agent, "scout");
    assert.equal(result.details.run.summary, "Waiting for backend.");
    assert.equal(result.details.run.startedAt, undefined);
    assert.match(result.content[0]?.text ?? "", /run_queued.*queued/);
  });

  it("reports completed runs", async () => {
    const { services, tool } = statusTool();
    services.runs.create({ id: "run_done", agent: "scout", task: "Inspect files.", runtime: "sdk" });
    services.runs.updateState("run_done", "starting", { runtime: "sdk" });
    services.runs.updateState("run_done", "running");
    services.runs.updateState("run_done", "completed", { summary: "Done." });

    const result = await tool.execute("call_1", { id: "run_done" });

    assert.equal(result.details.tool, "subagent_status");
    assert.equal(result.details.status, "completed");
    assert.equal(result.details.run.runtime, "sdk");
    assert.ok(result.details.run.startedAt);
    assert.ok(result.details.run.endedAt);
    assert.equal(result.details.run.summary, "Done.");
  });

  it("reports failed run errors", async () => {
    const { services, tool } = statusTool();
    const error = { code: "MOCK_FAILED", message: "Mock failure.", retryable: false };
    services.runs.create({ id: "run_failed", agent: "reviewer", task: "Review diff.", runtime: "subprocess" });
    services.runs.updateState("run_failed", "starting", { runtime: "subprocess" });
    services.runs.updateState("run_failed", "failed", { summary: "Failed.", error });

    const result = await tool.execute("call_1", { id: "run_failed" });

    assert.equal(result.details.tool, "subagent_status");
    assert.equal(result.details.status, "failed");
    assert.equal(result.details.error?.code, "MOCK_FAILED");
    assert.equal(result.details.error?.message, "Mock failure.");
    assert.equal(result.details.run.summary, "Failed.");
  });

  it("reports cancelled runs", async () => {
    const { services, tool } = statusTool();
    services.runs.create({ id: "run_cancelled", agent: "tester", task: "Run tests." });
    services.runs.updateState("run_cancelled", "cancelled", { summary: "Cancelled by user." });

    const result = await tool.execute("call_1", { id: "run_cancelled" });

    assert.equal(result.details.tool, "subagent_status");
    assert.equal(result.details.status, "cancelled");
    assert.equal(result.details.run.summary, "Cancelled by user.");
    assert.ok(result.details.run.endedAt);
  });

  it("rejects missing or unknown run IDs clearly", async () => {
    const { tool } = statusTool();

    await assert.rejects(
      () => tool.execute("call_1", {}),
      /id is required and must be a string/,
    );
    await assert.rejects(
      () => tool.execute("call_1", { id: "run_missing" }),
      (error) => error instanceof SubagentToolValidationError && /Unknown run ID "run_missing"/.test(error.message),
    );
  });
});
