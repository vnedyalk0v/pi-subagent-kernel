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
    assert.throws(() => registry.create({ id: "run_bad", agent: "scout", task: "Inspect", surprise: true } as never), /Unknown field "surprise"/);

    const inherited = Object.create({ agent: "scout", task: "Inspect", runtime: "sdk" });
    assert.throws(() => registry.create(inherited), /agent is required/);

    const generatedSelfParent = new RunRegistry({ now, idGenerator: () => "run_self" });
    assert.throws(() => generatedSelfParent.create({ agent: "scout", task: "Inspect", parentRunId: "run_self" }), /parentRunId must not equal id/);
  });

  it("updates lifecycle state through the documented happy path", () => {
    const registry = new RunRegistry({ now });
    registry.create({ id: "run_1", agent: "scout", task: "Inspect README.md", runtime: "sdk" });

    assert.equal(registry.updateState("run_1", "starting").startedAt, "2026-06-26T10:00:00.000Z");
    assert.equal(registry.updateState("run_1", "running", { summary: "Reading files" }).summary, "Reading files");
    assert.equal(registry.updateState("run_1", "running", { summary: "Still reading" }).summary, "Still reading");
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
    assert.throws(() => registry.updateState("run_1", "starting", Object.create({ runtime: "sdk" })), /runtime is required/);
    assert.throws(() => registry.updateState("run_1", "starting", { summmary: "typo" } as never), /Unknown field "summmary"/);
    assert.equal(registry.updateState("run_1", "starting", { runtime: "sdk" }).runtime, "sdk");
    assert.throws(() => registry.updateState("run_1", "running", { runtime: "subprocess" }), /runtime is already sdk/);
    assert.equal(registry.updateState("run_1", "running").status, "running");
    assert.throws(() => registry.updateState("run_1", "failed"), /failed runs require a structured error/);
    assert.throws(() => registry.updateState("run_1", "failed", { error: Object.create(timeoutError) }), /error.code is required/);
    assert.throws(() => registry.updateState("run_1", "failed", { error: { ...timeoutError, detail: {} } as never }), /Unknown field "error.detail"/);

    const failed = registry.updateState("run_1", "failed", {
      error: { ...timeoutError, details: { nested: { retryableAfterSec: 30 } } },
      summary: "Timed out",
    });
    assert.equal(failed.status, "failed");
    assert.equal(failed.error?.code, "timeout");
    assert.throws(() => (((failed.error?.details?.nested as { retryableAfterSec: number }).retryableAfterSec = 60)), TypeError);
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

    const failed = registry.storeResult({
      ...completedEnvelope("run_expire"),
      status: "failed",
      summary: "Failed after timeout.",
      endedAt: "2026-06-26T10:00:00.000Z",
      error: timeoutError,
    });
    assert.equal(failed.status, "failed");
  });

  it("stores and fetches a terminal result envelope", () => {
    const registry = new RunRegistry({ now });
    registry.create({ id: "run_1", agent: "scout", task: "Inspect README.md", runtime: "sdk", parentRunId: "run_parent" });
    registry.updateState("run_1", "starting");
    registry.updateState("run_1", "running");

    assert.throws(() => registry.storeResult({ ...completedEnvelope(), parentRunId: "run_parent", startedAt: "2026-06-26T09:59:59.000Z" }), /Result startedAt must match/);
    assert.throws(() => registry.storeResult({ ...completedEnvelope(), parentRunId: "other_parent" }), /Result parentRunId must match/);
    const envelope = registry.storeResult({ ...completedEnvelope(), parentRunId: "run_parent" });

    assert.equal(envelope.status, "completed");
    assert.equal(registry.result("run_1"), envelope);
    assert.equal(registry.status("run_1").summary, "Scout completed.");
    assert.deepEqual(registry.get("run_1")?.artifacts.map((artifact) => artifact.name), ["result.json"]);
    assert.throws(() => registry.storeResult(completedEnvelope()), /Result already stored/);
  });

  it("preserves terminal metadata when storing delayed results", () => {
    const registry = new RunRegistry({ now });
    registry.create({ id: "run_done", agent: "scout", task: "Inspect README.md", runtime: "sdk" });
    registry.updateState("run_done", "starting");
    registry.updateState("run_done", "running");
    registry.updateState("run_done", "completed", { summary: "Done" });

    assert.throws(() => registry.storeResult(completedEnvelope("run_done")), /Result endedAt must match/);
    assert.equal(registry.storeResult({ ...completedEnvelope("run_done"), endedAt: "2026-06-26T10:00:00.000Z" }).status, "completed");

    const failedRegistry = new RunRegistry({ now });
    failedRegistry.create({ id: "run_failed", agent: "scout", task: "Inspect README.md", runtime: "sdk" });
    failedRegistry.updateState("run_failed", "starting");
    failedRegistry.updateState("run_failed", "running");
    failedRegistry.updateState("run_failed", "failed", { error: timeoutError });

    assert.throws(
      () =>
        failedRegistry.storeResult({
          ...completedEnvelope("run_failed"),
          status: "failed",
          endedAt: "2026-06-26T10:00:00.000Z",
          error: { code: "other", message: "Different failure.", retryable: false },
        }),
      /Result error must match/,
    );
    assert.equal(
      failedRegistry.storeResult({ ...completedEnvelope("run_failed"), status: "failed", endedAt: "2026-06-26T10:00:00.000Z", error: timeoutError }).status,
      "failed",
    );
  });

  it("rejects invalid result envelopes and unknown runs", () => {
    const registry = new RunRegistry({ now });
    registry.create({ id: "run_1", agent: "scout", task: "Inspect README.md", runtime: "sdk" });

    assert.throws(() => registry.status("missing"), RunNotFoundError);
    assert.throws(() => registry.storeResult({ ...completedEnvelope(), agent: "reviewer" }), /Result agent must match run agent scout/);
    assert.throws(() => registry.storeResult({ ...completedEnvelope(), status: "running", endedAt: undefined }), /Result envelope status must be terminal/);
  });

});
