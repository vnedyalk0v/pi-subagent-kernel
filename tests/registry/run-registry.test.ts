import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DuplicateRunIdError,
  InvalidRunTransitionError,
  RunNotFoundError,
  RunRegistry,
} from "../../src/index.ts";

const now = () => new Date("2026-06-26T10:00:00.000Z");

function completedEnvelope(id = "run_1") {
  return {
    id,
    agent: "scout",
    runtime: "sdk",
    contextMode: "summary",
    status: "completed",
    startedAt: "2026-06-26T10:00:00.000Z",
    endedAt: "2026-06-26T10:00:01.000Z",
    summary: "Scout completed.",
    findings: [],
    artifacts: [{ name: "result.json", kind: "json", path: `runs/${id}/result.json` }],
    filesRead: ["README.md"],
    filesChanged: [],
    testsRun: [],
    cost: { estimatedUsd: null },
    confidence: 1,
    nextActions: [],
  };
}

const timeoutError = {
  code: "timeout",
  message: "Subagent exceeded its runtime limit.",
  retryable: true,
};

describe("RunRegistry", () => {
  it("creates runs and fetches status by run ID", () => {
    const registry = new RunRegistry({ now, idGenerator: () => "run_generated" });
    const generated = registry.create({ agent: "scout", task: "Inspect README.md" });
    const explicit = registry.create({ id: "run_2", agent: "reviewer", task: "Review diff", runtime: "sdk" });

    assert.equal(generated.id, "run_generated");
    assert.equal(generated.status, "queued");
    assert.equal(explicit.runtime, "sdk");
    assert.equal(registry.get("run_generated"), generated);
    assert.deepEqual(registry.status("run_2"), {
      id: "run_2",
      agent: "reviewer",
      runtime: "sdk",
      status: "queued",
    });
  });

  it("validates create input and duplicate run IDs", () => {
    const registry = new RunRegistry({ now });
    registry.create({ id: "run_1", agent: "scout", task: "Inspect README.md" });

    assert.throws(() => registry.create({ id: "run_1", agent: "scout", task: "Again" }), DuplicateRunIdError);
    assert.throws(() => registry.create({ id: "run_bad", agent: " ", task: "Inspect" }), /agent must not be empty/);
    assert.throws(() => registry.create({ id: "run_bad", agent: "scout", task: "Inspect", runtime: "auto" as never }), /runtime must be one of/);
  });

  it("updates lifecycle state through the documented happy path", () => {
    const registry = new RunRegistry({ now });
    registry.create({ id: "run_1", agent: "scout", task: "Inspect README.md", runtime: "sdk" });

    assert.equal(registry.updateState("run_1", "starting").startedAt, "2026-06-26T10:00:00.000Z");
    assert.equal(registry.updateState("run_1", "running", { summary: "Reading files" }).summary, "Reading files");
    assert.equal(registry.updateState("run_1", "waiting_for_input").status, "waiting_for_input");
    assert.equal(registry.updateState("run_1", "running").status, "running");

    const completed = registry.updateState("run_1", "completed", { summary: "Done" });
    assert.equal(completed.status, "completed");
    assert.equal(completed.endedAt, "2026-06-26T10:00:00.000Z");
    assert.deepEqual(registry.status("run_1"), {
      id: "run_1",
      agent: "scout",
      runtime: "sdk",
      status: "completed",
      startedAt: "2026-06-26T10:00:00.000Z",
      endedAt: "2026-06-26T10:00:00.000Z",
      summary: "Done",
    });
  });

  it("rejects invalid state transitions", () => {
    const registry = new RunRegistry({ now });
    registry.create({ id: "run_1", agent: "scout", task: "Inspect README.md", runtime: "sdk" });

    assert.throws(
      () => registry.updateState("run_1", "completed"),
      (error) => error instanceof InvalidRunTransitionError && error.from === "queued" && error.to === "completed",
    );
    assert.equal(registry.updateState("run_1", "cancelled").status, "cancelled");
    assert.throws(() => registry.updateState("run_1", "running"), InvalidRunTransitionError);
  });

  it("requires runtime and structured errors for active or failed states", () => {
    const registry = new RunRegistry({ now });
    registry.create({ id: "run_1", agent: "scout", task: "Inspect README.md" });

    assert.throws(() => registry.updateState("run_1", "starting"), /runtime is required before moving to starting/);
    assert.equal(registry.updateState("run_1", "starting", { runtime: "sdk" }).runtime, "sdk");
    assert.equal(registry.updateState("run_1", "running").status, "running");
    assert.throws(() => registry.updateState("run_1", "failed"), /failed runs require a structured error/);

    const failed = registry.updateState("run_1", "failed", { error: timeoutError, summary: "Timed out" });
    assert.equal(failed.status, "failed");
    assert.equal(failed.error?.code, "timeout");
  });

  it("marks runs cancelled and expired", () => {
    const registry = new RunRegistry({ now });
    registry.create({ id: "run_cancel", agent: "scout", task: "Inspect README.md" });
    registry.create({ id: "run_expire", agent: "scout", task: "Inspect README.md", runtime: "sdk" });

    assert.deepEqual(registry.updateState("run_cancel", "cancelled", { summary: "No longer needed" }), {
      id: "run_cancel",
      agent: "scout",
      task: "Inspect README.md",
      status: "cancelled",
      createdAt: "2026-06-26T10:00:00.000Z",
      endedAt: "2026-06-26T10:00:00.000Z",
      summary: "No longer needed",
      artifacts: [],
    });

    registry.updateState("run_expire", "starting");
    registry.updateState("run_expire", "running");
    const expired = registry.updateState("run_expire", "expired", { error: timeoutError });
    assert.equal(expired.status, "expired");
    assert.equal(expired.error?.retryable, true);
  });

  it("stores and fetches a terminal result envelope", () => {
    const registry = new RunRegistry({ now });
    registry.create({ id: "run_1", agent: "scout", task: "Inspect README.md", runtime: "sdk" });
    registry.updateState("run_1", "starting");
    registry.updateState("run_1", "running");

    const envelope = registry.storeResult(completedEnvelope());

    assert.equal(envelope.status, "completed");
    assert.equal(registry.result("run_1"), envelope);
    assert.equal(registry.status("run_1").summary, "Scout completed.");
    assert.deepEqual(registry.get("run_1")?.artifacts.map((artifact) => artifact.name), ["result.json"]);
    assert.throws(() => registry.storeResult(completedEnvelope()), /Result already stored/);
  });

  it("rejects invalid result envelopes and unknown runs", () => {
    const registry = new RunRegistry({ now });
    registry.create({ id: "run_1", agent: "scout", task: "Inspect README.md", runtime: "sdk" });

    assert.throws(() => registry.status("missing"), RunNotFoundError);
    assert.throws(() => registry.storeResult({ ...completedEnvelope(), agent: "reviewer" }), /Result agent must match run agent scout/);
    assert.throws(() => registry.storeResult({ ...completedEnvelope(), status: "running", endedAt: undefined }), /Result envelope status must be terminal/);
  });

});
