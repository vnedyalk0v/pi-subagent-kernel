import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RUN_STATES,
  RunEnvelopeValidationError,
  isRunState,
  parseRunEnvelope,
  validateRunEnvelope,
} from "../../src/contracts/index.ts";

const validEnvelope = {
  id: "run_01JABC",
  parentRunId: null,
  agent: "reviewer",
  runtime: "subprocess",
  contextMode: "summary",
  status: "completed",
  startedAt: "2026-06-26T10:00:00.000Z",
  endedAt: "2026-06-26T10:03:00.000Z",
  summary: "The change is mostly safe; one concurrency risk remains.",
  findings: [
    {
      severity: "high",
      title: "Concurrent refresh can overwrite a newer token",
      file: "src/auth/session.ts",
      line: 184,
      evidence: "The write path does not compare token version before update.",
      recommendation: "Use compare-and-swap or version check before writing.",
    },
  ],
  artifacts: [
    {
      name: "review.json",
      kind: "json",
      path: "runs/run_01JABC/artifacts/review.json",
      bytes: 128,
      sha256: "abc123",
    },
  ],
  filesRead: ["src/auth/session.ts"],
  filesChanged: [],
  commandsRun: ["npm test"],
  testsRun: ["npm test"],
  cost: {
    estimatedUsd: 0.42,
    inputTokens: 12431,
    outputTokens: 2210,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  confidence: 0.82,
  nextActions: ["Add concurrency regression test"],
};

describe("RunState", () => {
  it("includes the required lifecycle states", () => {
    assert.deepEqual([...RUN_STATES], [
      "queued",
      "starting",
      "running",
      "waiting_for_input",
      "completed",
      "failed",
      "cancelled",
      "expired",
    ]);
    assert.equal(isRunState("waiting_for_input"), true);
    assert.equal(isRunState("stale"), false);
  });
});

describe("RunEnvelope", () => {
  it("accepts the documented standard result envelope", () => {
    const envelope = parseRunEnvelope(validEnvelope);

    assert.equal(envelope.id, "run_01JABC");
    assert.equal(envelope.status, "completed");
    assert.equal(envelope.findings[0].severity, "high");
    assert.equal(envelope.cost.estimatedUsd, 0.42);
    assert.deepEqual(envelope.nextActions, ["Add concurrency regression test"]);
  });

  it("accepts unknown cost as explicit null", () => {
    const envelope = parseRunEnvelope({ ...validEnvelope, cost: { estimatedUsd: null } });

    assert.equal(envelope.cost.estimatedUsd, null);
  });

  it("rejects missing required fields", () => {
    const { summary: _summary, cost: _cost, ...missingRequired } = validEnvelope;
    const result = validateRunEnvelope(missingRequired);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.issues.map((issue) => issue.path), ["summary", "cost"]);
    }
  });

  it("rejects missing runtime backend", () => {
    const { runtime: _runtime, ...withoutRuntime } = validEnvelope;

    assert.throws(() => parseRunEnvelope(withoutRuntime), /runtime is required/);
  });

  it("rejects missing context mode", () => {
    const { contextMode: _contextMode, ...withoutContextMode } = validEnvelope;

    assert.throws(() => parseRunEnvelope(withoutContextMode), /contextMode is required/);
  });

  it("rejects invalid status values", () => {
    assert.throws(() => parseRunEnvelope({ ...validEnvelope, status: "stale" }), /status must be one of/);
  });

  it("rejects terminal envelopes without timestamps", () => {
    const { startedAt: _startedAt, endedAt: _endedAt, ...withoutTimestamps } = validEnvelope;

    assert.throws(() => parseRunEnvelope(withoutTimestamps), /completed run envelopes require startedAt and endedAt/);
  });

  it("rejects non-ISO or impossible timestamps", () => {
    assert.throws(() => parseRunEnvelope({ ...validEnvelope, startedAt: "1" }), /startedAt must be an ISO timestamp/);
    assert.throws(
      () => parseRunEnvelope({ ...validEnvelope, endedAt: "2026-02-30T10:00:00.000Z" }),
      /endedAt must be an ISO timestamp/,
    );
  });

  it("rejects invalid confidence range", () => {
    assert.throws(() => parseRunEnvelope({ ...validEnvelope, confidence: 1.2 }), /confidence/);
  });

  it("rejects unstructured failed results", () => {
    assert.throws(
      () => parseRunEnvelope({ ...validEnvelope, status: "failed" }),
      /failed run envelopes require a structured error/,
    );
  });

  it("accepts structured failed results", () => {
    const envelope = parseRunEnvelope({
      ...validEnvelope,
      status: "failed",
      error: {
        code: "timeout",
        message: "Subagent exceeded maxRuntimeSec=1800.",
        retryable: true,
        details: { elapsedMs: 1801000 },
      },
    });

    assert.equal(envelope.error?.code, "timeout");
  });

  it("rejects unknown fields", () => {
    assert.throws(() => parseRunEnvelope({ ...validEnvelope, transcript: "hidden" }), /Unknown field "transcript"/);
  });

  it("freezes normalized envelopes", () => {
    const envelope = parseRunEnvelope(validEnvelope);

    assert.throws(() => envelope.filesRead.push("secret.env"), TypeError);
    assert.throws(() => ((envelope.cost as { estimatedUsd: number | null }).estimatedUsd = 99), TypeError);
  });

  it("throws a typed validation error", () => {
    assert.throws(
      () => parseRunEnvelope({ ...validEnvelope, cost: { estimatedUsd: -1 } }),
      (error) =>
        error instanceof RunEnvelopeValidationError &&
        error.issues.some((issue) => issue.path === "cost.estimatedUsd" && /non-negative/.test(issue.message)),
    );
  });
});
