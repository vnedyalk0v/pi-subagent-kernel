import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ExecutionBackendValidationError,
  parseRunEnvelope,
  parseRunStatus,
  parseSpawnInput,
  runStatusFromEnvelope,
  validateSpawnInput,
  type ExecutionBackend,
  type RunEnvelope,
  type RunStatus,
  type SpawnInput,
} from "../../src/contracts/index.ts";

const validAgent = {
  name: "scout",
  description: "Read-only explorer.",
  instructions: "Gather evidence only.",
  runtime: "sdk",
};

const validSpawnInput = {
  agent: validAgent,
  task: "Inspect the contracts.",
  context: {
    mode: "summary",
    parentRunId: null,
    summary: "Parent already read README.md.",
    files: ["README.md"],
  },
  policy: {},
  output: {
    mode: "json",
    schema: "inspection_v1",
    artifactPath: "runs/run_mock/result.json",
  },
};

class MockExecutionBackend implements ExecutionBackend {
  readonly id = "sdk" as const;
  #nextId = 1;
  #runs = new Map<string, RunEnvelope>();

  async spawn(input: SpawnInput): Promise<RunStatus> {
    const normalized = parseSpawnInput(input);
    const envelope = parseRunEnvelope({
      id: `run_mock_${this.#nextId++}`,
      agent: normalized.agent.name,
      runtime: this.id,
      contextMode: normalized.context.mode,
      status: "running",
      startedAt: "2026-06-26T10:00:00.000Z",
      summary: `Running: ${normalized.task}`,
      findings: [],
      artifacts: [],
      filesRead: normalized.context.files,
      filesChanged: [],
      testsRun: [],
      cost: { estimatedUsd: null },
      confidence: 1,
      nextActions: [],
    });
    this.#runs.set(envelope.id, envelope);
    return runStatusFromEnvelope(envelope);
  }

  async status(runId: string): Promise<RunStatus> {
    return runStatusFromEnvelope(this.#get(runId));
  }

  async result(runId: string): Promise<RunEnvelope> {
    const current = this.#get(runId);
    if (current.status !== "running") {
      return current;
    }

    const completed = parseRunEnvelope({
      ...current,
      status: "completed",
      endedAt: "2026-06-26T10:00:01.000Z",
      summary: "Mock backend completed.",
    });
    this.#runs.set(runId, completed);
    return completed;
  }

  async cancel(runId: string, reason = "cancelled"): Promise<RunStatus> {
    const current = this.#get(runId);
    const cancelled = parseRunEnvelope({
      ...current,
      status: "cancelled",
      endedAt: "2026-06-26T10:00:01.000Z",
      summary: `Mock backend cancelled: ${reason}`,
    });
    this.#runs.set(runId, cancelled);
    return runStatusFromEnvelope(cancelled);
  }

  #get(runId: string): RunEnvelope {
    const run = this.#runs.get(runId);
    if (!run) {
      throw new Error(`Unknown run ${runId}`);
    }
    return run;
  }
}

describe("ExecutionBackend", () => {
  it("normalizes spawn input with agent, task, context, policy, and output requirements", () => {
    const input = parseSpawnInput(validSpawnInput);

    assert.equal(input.agent.name, "scout");
    assert.equal(input.task, "Inspect the contracts.");
    assert.equal(input.context.mode, "summary");
    assert.deepEqual(input.context.files, ["README.md"]);
    assert.equal(input.policy.maxDepth, 1);
    assert.equal(input.output.mode, "json");
    assert.equal(input.output.schema, "inspection_v1");
  });

  it("rejects invalid spawn input with actionable paths", () => {
    const result = validateSpawnInput({
      ...validSpawnInput,
      task: " ",
      context: { mode: "everything", files: ["README.md", 7] },
      policy: { network: "internet" },
      output: { mode: "freeform" },
      surprise: true,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.issues.map((issue) => issue.path), [
        "surprise",
        "task",
        "context.mode",
        "context.files[1]",
        "policy.network",
        "output.mode",
      ]);
    }
  });

  it("requires output requirements at the spawn boundary", () => {
    const { output: _output, ...withoutOutput } = validSpawnInput;

    assert.throws(
      () => parseSpawnInput(withoutOutput),
      (error) => error instanceof ExecutionBackendValidationError && /output is required/.test(error.message),
    );
  });

  it("validates run status without allowing unresolved auto runtime", () => {
    const status = parseRunStatus({
      id: "run_mock_1",
      agent: "scout",
      runtime: "sdk",
      status: "running",
      startedAt: "2026-06-26T10:00:00.000Z",
    });

    assert.equal(status.status, "running");
    assert.throws(() => parseRunStatus({ ...status, runtime: "auto" }), /runtime must be one of/);
  });

  it("lets mock backends share spawn, status, result, and cancel around RunEnvelope", async () => {
    const backend = new MockExecutionBackend();
    const started = await backend.spawn(parseSpawnInput(validSpawnInput));

    assert.equal(started.status, "running");
    assert.equal((await backend.status(started.id)).status, "running");

    const result = await backend.result(started.id);
    assert.equal(result.status, "completed");
    assert.equal(result.agent, "scout");
    assert.deepEqual(result.filesRead, ["README.md"]);

    const cancellable = await backend.spawn(parseSpawnInput(validSpawnInput));
    const cancelled = await backend.cancel(cancellable.id, "not needed");
    assert.equal(cancelled.status, "cancelled");
    assert.equal((await backend.result(cancellable.id)).status, "cancelled");
  });
});
