import {
  parseSpawnInput,
  runStatusFromEnvelope,
  type ExecutionBackend,
  type ExecutionBackendId,
  type RunStatus,
  type SpawnInput,
} from "../contracts/execution-backend.ts";
import { parseRunEnvelope, type RunEnvelope } from "../contracts/run-envelope.ts";

export type MockExecutionOutcome = "success" | "failure" | "running";

export interface MockExecutionBackendOptions {
  id?: ExecutionBackendId;
  outcome?: MockExecutionOutcome;
  now?: () => Date;
}

/** Deterministic ExecutionBackend for tests and demos. It never calls models, network, shell, or subprocesses. */
export class MockExecutionBackend implements ExecutionBackend {
  readonly id: ExecutionBackendId;

  readonly #outcome: MockExecutionOutcome;
  readonly #now: () => Date;
  readonly #runs = new Map<string, RunEnvelope>();

  constructor(options: MockExecutionBackendOptions = {}) {
    this.id = options.id ?? "sdk";
    this.#outcome = options.outcome ?? "success";
    this.#now = options.now ?? (() => new Date());
  }

  async spawn(input: SpawnInput): Promise<RunStatus> {
    const normalized = parseSpawnInput(input);
    if (this.#runs.has(normalized.runId)) {
      throw new Error(`Duplicate mock run "${normalized.runId}".`);
    }

    const envelope = parseRunEnvelope({
      id: normalized.runId,
      ...(normalized.context.parentRunId !== undefined ? { parentRunId: normalized.context.parentRunId } : {}),
      agent: normalized.agent.name,
      runtime: this.id,
      contextMode: normalized.context.mode,
      status: "running",
      startedAt: this.#now().toISOString(),
      summary: `Mock ${normalized.agent.name} running: ${normalized.task}`,
      findings: [],
      artifacts: [],
      filesRead: normalized.context.files,
      filesChanged: [],
      commandsRun: [],
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
    if (current.status !== "running" || this.#outcome === "running") {
      return current;
    }

    const result = this.#outcome === "failure" ? this.#fail(current) : this.#complete(current);
    this.#runs.set(runId, result);
    return result;
  }

  async cancel(runId: string, reason = "Cancellation requested."): Promise<RunStatus> {
    const current = this.#get(runId);
    if (current.status !== "running") {
      return runStatusFromEnvelope(current);
    }

    const cancelled = parseRunEnvelope({
      ...current,
      status: "cancelled",
      endedAt: this.#endedAt(current),
      summary: `Mock ${current.agent} cancelled: ${reason}`,
      confidence: 0,
    });
    this.#runs.set(runId, cancelled);
    return runStatusFromEnvelope(cancelled);
  }

  #complete(current: RunEnvelope): RunEnvelope {
    return parseRunEnvelope({
      ...current,
      status: "completed",
      endedAt: this.#endedAt(current),
      summary: `Mock ${current.agent} completed.`,
      nextActions: ["Replace the mock backend with real execution before relying on subagent output."],
    });
  }

  #fail(current: RunEnvelope): RunEnvelope {
    return parseRunEnvelope({
      ...current,
      status: "failed",
      endedAt: this.#endedAt(current),
      summary: `Mock ${current.agent} failed.`,
      confidence: 0,
      nextActions: [],
      error: {
        code: "MOCK_FAILED",
        message: "Mock backend simulated failure.",
        retryable: false,
      },
    });
  }

  #endedAt(current: RunEnvelope): string {
    return new Date(Date.parse(current.startedAt ?? this.#now().toISOString()) + 1).toISOString();
  }

  #get(runId: string): RunEnvelope {
    const run = this.#runs.get(runId);
    if (!run) {
      throw new Error(`Unknown mock run "${runId}".`);
    }
    return run;
  }
}
