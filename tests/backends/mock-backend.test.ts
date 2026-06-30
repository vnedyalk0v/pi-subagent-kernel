import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MockExecutionBackend, parseSpawnInput, type SpawnInput } from "../../src/index.ts";

const startedAt = "2026-06-26T10:00:00.000Z";
const endedAt = "2026-06-26T10:00:00.001Z";

const agent = {
  name: "scout",
  description: "Read-only explorer.",
  instructions: "Gather evidence only.",
  runtime: "sdk",
};

function spawnInput(runId = "run_mock_1"): SpawnInput {
  return parseSpawnInput({
    runId,
    agent,
    task: "Inspect README.md",
    context: { mode: "summary", parentRunId: null, files: ["README.md"] },
    policy: {},
    limits: { maxRuntimeSec: 1800 },
    output: { mode: "json" },
  });
}

function fixedNow(): Date {
  return new Date(startedAt);
}

describe("MockExecutionBackend", () => {
  it("completes deterministic mock runs with valid RunEnvelopes", async () => {
    const backend = new MockExecutionBackend({ now: fixedNow });
    const started = await backend.spawn(spawnInput());

    assert.equal(started.status, "running");
    assert.equal(started.runtime, "sdk");
    assert.equal(started.startedAt, startedAt);

    const result = await backend.result(started.id);
    assert.equal(result.status, "completed");
    assert.equal(result.startedAt, startedAt);
    assert.equal(result.endedAt, endedAt);
    assert.equal(result.agent, "scout");
    assert.deepEqual(result.filesRead, ["README.md"]);
    assert.deepEqual(result.filesChanged, []);
    assert.deepEqual(result.commandsRun, []);
    assert.equal(result.cost.estimatedUsd, null);
  });

  it("simulates failure without external execution", async () => {
    const backend = new MockExecutionBackend({ id: "subprocess", outcome: "failure", now: fixedNow });
    await backend.spawn(spawnInput("run_failed"));

    const result = await backend.result("run_failed");

    assert.equal(result.status, "failed");
    assert.equal(result.runtime, "subprocess");
    assert.equal(result.error?.code, "MOCK_FAILED");
    assert.deepEqual(result.commandsRun, []);
  });

  it("can leave runs running for status/result polling tests", async () => {
    const backend = new MockExecutionBackend({ outcome: "running", now: fixedNow });
    await backend.spawn(spawnInput("run_running"));

    const result = await backend.result("run_running");
    const status = await backend.status("run_running");

    assert.equal(result.status, "running");
    assert.equal(result.endedAt, undefined);
    assert.equal(status.status, "running");
  });

  it("cancels active mock runs and keeps cancellation inspectable", async () => {
    const backend = new MockExecutionBackend({ now: fixedNow });
    await backend.spawn(spawnInput("run_cancel"));

    const cancelled = await backend.cancel("run_cancel", "No longer needed.");
    const result = await backend.result("run_cancel");

    assert.equal(cancelled.status, "cancelled");
    assert.equal(result.status, "cancelled");
    assert.equal(result.endedAt, endedAt);
    assert.match(result.summary, /No longer needed/);
  });

  it("rejects duplicate and unknown mock run IDs clearly", async () => {
    const backend = new MockExecutionBackend();

    await backend.spawn(spawnInput("run_duplicate"));

    await assert.rejects(() => backend.spawn(spawnInput("run_duplicate")), /Duplicate mock run "run_duplicate"/);
    await assert.rejects(() => backend.status("run_missing"), /Unknown mock run "run_missing"/);
  });
});
