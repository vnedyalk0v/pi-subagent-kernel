import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RunNotFoundError } from "../../src/registry/index.ts";
import { createSubagentToolServices, createSubagentTools } from "../../src/tools/subagent-tools.ts";

function tools() {
  const services = createSubagentToolServices();
  const all = createSubagentTools(services);
  const spawn = all.find((item) => item.name === "subagent_spawn");
  const result = all.find((item) => item.name === "subagent_result");
  assert.ok(spawn);
  assert.ok(result);
  return { services, spawn, result };
}

describe("subagent_result", () => {
  it("returns a RunEnvelope for completed runs", async () => {
    const { spawn, result } = tools();
    const spawned = await spawn.execute("call_1", { agent: "scout", task: "Inspect README.md", mode: "background" });
    assert.equal(spawned.details.tool, "subagent_spawn");

    const output = await result.execute("call_2", { id: spawned.details.id, includeArtifacts: true, includeEvents: false });

    assert.equal(output.details.tool, "subagent_result");
    assert.equal(output.details.status, "completed");
    assert.equal(output.details.id, spawned.details.id);
    assert.equal(output.details.result?.status, "completed");
    assert.equal(output.details.result?.agent, "scout");
    assert.match(output.content[0]?.text ?? "", /result is completed/);
  });

  it("returns status while a run is still running", async () => {
    const { services, result } = tools();
    services.runs.create({ id: "run_running", agent: "tester", task: "Run tests.", runtime: "subprocess" });
    services.runs.updateState("run_running", "starting", { runtime: "subprocess" });
    services.runs.updateState("run_running", "running", { summary: "Running tests." });

    const output = await result.execute("call_1", { id: "run_running" });

    assert.equal(output.details.tool, "subagent_result");
    assert.equal(output.details.status, "running");
    assert.equal(output.details.result, undefined);
    assert.equal(output.details.run.summary, "Running tests.");
  });

  it("returns failed RunEnvelopes and error metadata", async () => {
    const { services, result } = tools();
    const error = { code: "MOCK_FAILED", message: "Mock failure.", retryable: false };
    services.runs.create({ id: "run_failed", agent: "reviewer", task: "Review diff.", runtime: "subprocess" });
    const started = services.runs.updateState("run_failed", "starting", { runtime: "subprocess" });
    const failed = services.runs.updateState("run_failed", "failed", { summary: "Failed.", error });
    services.runs.storeResult({
      id: "run_failed",
      agent: "reviewer",
      runtime: "subprocess",
      contextMode: "summary",
      status: "failed",
      startedAt: started.startedAt,
      endedAt: failed.endedAt,
      summary: "Failed.",
      findings: [],
      artifacts: [],
      filesRead: [],
      filesChanged: [],
      testsRun: [],
      cost: { estimatedUsd: null },
      confidence: 0,
      nextActions: [],
      error,
    });

    const output = await result.execute("call_1", { id: "run_failed" });

    assert.equal(output.details.tool, "subagent_result");
    assert.equal(output.details.status, "failed");
    assert.equal(output.details.result?.status, "failed");
    assert.equal(output.details.error?.code, "MOCK_FAILED");
  });

  it("handles missing run IDs clearly", async () => {
    const { result } = tools();

    await assert.rejects(
      () => result.execute("call_1", {}),
      /id is required and must be a string/,
    );
    await assert.rejects(
      () => result.execute("call_1", { id: "run_missing" }),
      (error) => error instanceof RunNotFoundError && /Unknown run ID "run_missing"/.test(error.message),
    );
  });
});
