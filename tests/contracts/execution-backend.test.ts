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
  runId: "run_mock_1",
  agent: validAgent,
  task: "Inspect the contracts.",
  context: {
    mode: "summary",
    parentRunId: null,
    summary: "Parent already read README.md.",
    files: ["README.md"],
  },
  policy: {},
  limits: {
    maxRuntimeSec: 1800,
  },
  output: {
    mode: "json",
    schema: "inspection_v1",
    artifactPath: "runs/run_mock/result.json",
  },
};

class MockExecutionBackend implements ExecutionBackend {
  readonly id = "sdk" as const;
  #runs = new Map<string, RunEnvelope>();

  async spawn(input: SpawnInput): Promise<RunStatus> {
    const normalized = parseSpawnInput(input);
    const envelope = parseRunEnvelope({
      id: normalized.runId,
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

    assert.equal(input.runId, "run_mock_1");
    assert.equal(input.agent.name, "scout");
    assert.equal(input.task, "Inspect the contracts.");
    assert.equal(input.context.mode, "summary");
    assert.deepEqual(input.context.files, ["README.md"]);
    assert.equal(input.policy.maxDepth, 1);
    assert.equal(input.limits.maxRuntimeSec, 1800);
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

  it("rejects full context until policy approval is represented", () => {
    assert.throws(
      () => parseSpawnInput({ ...validSpawnInput, context: { ...validSpawnInput.context, mode: "full" } }),
      /context\.mode full requires explicit policy approval/,
    );
  });

  it("requires effective runtime limits at the spawn boundary", () => {
    const { limits: _limits, ...withoutLimits } = validSpawnInput;

    assert.throws(
      () => parseSpawnInput(withoutLimits),
      (error) => error instanceof ExecutionBackendValidationError && /limits is required/.test(error.message),
    );
    assert.throws(() => parseSpawnInput({ ...validSpawnInput, limits: { maxRuntimeSec: 0 } }), /positive integer/);
  });

  it("requires output requirements at the spawn boundary", () => {
    const { output: _output, ...withoutOutput } = validSpawnInput;

    assert.throws(
      () => parseSpawnInput(withoutOutput),
      (error) => error instanceof ExecutionBackendValidationError && /output is required/.test(error.message),
    );
  });

  it("rejects inherited spawn input fields", () => {
    const input = Object.create(validSpawnInput) as Record<string, unknown>;
    input.task = "Inspect only.";

    const result = validateSpawnInput(input);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.issues.map((issue) => issue.path), ["runId", "agent", "context", "policy", "limits", "output"]);
    }
  });

  it("strips inherited fields inside spawned agent specs", () => {
    const agent = Object.create({ tools: ["write"], sandbox: { shell: "allow" } }) as Record<string, unknown>;
    agent.name = "scout";
    agent.description = "Read-only explorer.";
    agent.instructions = "Gather evidence only.";

    const input = parseSpawnInput({ ...validSpawnInput, agent });

    assert.deepEqual(input.agent.tools, []);
    assert.equal(input.agent.sandbox.shell, "none");
  });

  it("rejects inherited array entries inside spawned agent specs", () => {
    const inheritedTools = new Array<string>(1);
    Object.setPrototypeOf(inheritedTools, { 0: "write", __proto__: Array.prototype });

    assert.throws(
      () => parseSpawnInput({ ...validSpawnInput, agent: { ...validAgent, tools: inheritedTools } }),
      /agent\.tools\[0\]: tools\[0\] must be a string/,
    );
  });

  it("rejects context payload fields for none mode", () => {
    assert.throws(
      () => parseSpawnInput({ ...validSpawnInput, context: { mode: "none", summary: "leak", files: ["README.md"] } }),
      /context\.mode none must not include summary or files/,
    );
  });

  it("rejects self-parented spawn requests", () => {
    assert.throws(
      () => parseSpawnInput({ ...validSpawnInput, context: { ...validSpawnInput.context, parentRunId: validSpawnInput.runId } }),
      /context\.parentRunId must not equal runId/,
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

  it("allows queued run status before runtime selection", () => {
    const status = parseRunStatus({ id: "run_mock_1", agent: "scout", status: "queued" });

    assert.equal(status.status, "queued");
    assert.equal(status.runtime, undefined);
    assert.throws(
      () => parseRunStatus({ id: "run_mock_1", agent: "scout", status: "starting" }),
      /runtime is required once a run leaves queued/,
    );
  });

  it("allows cancelling queued runs before runtime selection", () => {
    const status = parseRunStatus({
      id: "run_mock_1",
      agent: "scout",
      status: "cancelled",
      endedAt: "2026-06-26T10:00:01.000Z",
    });

    assert.equal(status.status, "cancelled");
    assert.equal(status.runtime, undefined);
  });

  it("requires start times for active run statuses", () => {
    assert.throws(
      () => parseRunStatus({ id: "run_mock_1", agent: "scout", runtime: "sdk", status: "running" }),
      /running run statuses require startedAt/,
    );
  });

  it("requires runtime for started cancellations", () => {
    assert.throws(
      () =>
        parseRunStatus({
          id: "run_mock_1",
          agent: "scout",
          status: "cancelled",
          startedAt: "2026-06-26T10:00:00.000Z",
          endedAt: "2026-06-26T10:00:01.000Z",
        }),
      /runtime is required once a run leaves queued/,
    );
  });

  it("rejects end timestamps on active statuses", () => {
    assert.throws(
      () =>
        parseRunStatus({
          id: "run_mock_1",
          agent: "scout",
          runtime: "sdk",
          status: "running",
          startedAt: "2026-06-26T10:00:00.000Z",
          endedAt: "2026-06-26T10:00:01.000Z",
        }),
      /running run statuses must not include endedAt/,
    );
  });

  it("rejects terminal run statuses without start and end timestamps", () => {
    assert.throws(
      () => parseRunStatus({ id: "run_mock_1", agent: "scout", runtime: "sdk", status: "completed" }),
      /completed run statuses require startedAt and endedAt/,
    );
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

    const cancellable = await backend.spawn(parseSpawnInput({ ...validSpawnInput, runId: "run_mock_2" }));
    const cancelled = await backend.cancel(cancellable.id, "not needed");
    assert.equal(cancelled.status, "cancelled");
    assert.equal((await backend.result(cancellable.id)).status, "cancelled");
  });
});
