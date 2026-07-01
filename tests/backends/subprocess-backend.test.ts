import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildPiRpcArgs, parseSpawnInput, SubprocessExecutionBackend, type SpawnInput } from "../../src/index.ts";

const startedAt = "2026-06-26T10:00:00.000Z";
const fixtureRoot = new URL("../fixtures/", import.meta.url);

const agent = {
  name: "reviewer",
  description: "Read-only reviewer.",
  instructions: "Review with evidence only.",
  runtime: "subprocess",
  tools: ["read", "grep", "find", "ls", "bash:test-only"],
  permissions: { filesystem: "read-only", network: "none", shell: "test-only" },
};

function fixture(name: string): string {
  return fileURLToPath(new URL(name, fixtureRoot));
}

function spawnInput(runId = "run_subprocess_1", maxRuntimeSec = 5): SpawnInput {
  return parseSpawnInput({
    runId,
    agent,
    task: "Inspect README.md",
    context: { mode: "summary", summary: "Only this summary is inherited.", files: ["README.md"] },
    policy: {},
    limits: { maxRuntimeSec },
    output: { mode: "json" },
  });
}

function backend(script: string): SubprocessExecutionBackend {
  return new SubprocessExecutionBackend({
    command: process.execPath,
    args: [fixture(script)],
    now: () => new Date(startedAt),
    killGraceMs: 10,
  });
}

describe("SubprocessExecutionBackend", () => {
  it("spawns a child process and converts RPC final output into a RunEnvelope", async () => {
    const subprocess = backend("subprocess-rpc-success.mjs");
    const started = await subprocess.spawn(spawnInput("run_subprocess_success"));

    assert.equal(started.status, "running");
    assert.equal(started.runtime, "subprocess");
    assert.equal(started.startedAt, startedAt);

    const result = await subprocess.result(started.id);
    assert.equal(result.id, started.id);
    assert.equal(result.status, "completed");
    assert.equal(result.runtime, "subprocess");
    assert.equal(result.startedAt, startedAt);
    assert.equal(result.endedAt, startedAt);
    assert.equal(result.summary, "fixture completed");
    assert.equal(result.parentRunId, undefined);
    assert.deepEqual(result.filesRead, ["README.md"]);
    assert.deepEqual(result.filesChanged, []);
  });

  it("captures stdout and stderr for failed child processes", async () => {
    const subprocess = backend("subprocess-fail.mjs");
    await subprocess.spawn(spawnInput("run_subprocess_failed"));

    const result = await subprocess.result("run_subprocess_failed");

    assert.equal(result.status, "failed");
    assert.equal(result.error?.code, "SUBPROCESS_EXIT_NONZERO");
    assert.equal(result.error?.details?.exitCode, 2);
    assert.match(String(result.error?.details?.stdout), /partial stdout/);
    assert.match(String(result.error?.details?.stderr), /fixture failed/);
  });

  it("returns a failed envelope when stdout has no valid RunEnvelope", async () => {
    const subprocess = backend("subprocess-rpc-invalid.mjs");
    await subprocess.spawn(spawnInput("run_subprocess_invalid"));

    const result = await subprocess.result("run_subprocess_invalid");

    assert.equal(result.status, "failed");
    assert.equal(result.error?.code, "SUBPROCESS_INVALID_RESULT");
    assert.match(String(result.error?.details?.stdout), /not json/);
  });

  it("returns the RPC prompt rejection instead of waiting for timeout", async () => {
    const subprocess = backend("subprocess-rpc-reject.mjs");
    await subprocess.spawn(spawnInput("run_subprocess_reject", 5));

    const result = await subprocess.result("run_subprocess_reject");

    assert.equal(result.status, "failed");
    assert.equal(result.error?.code, "SUBPROCESS_RPC_PROMPT_REJECTED");
    assert.match(result.summary, /bad config/);
  });

  it("bounds stdout capture and the pending parse buffer", async () => {
    const subprocess = backend("subprocess-large-stdout.mjs");
    await subprocess.spawn(spawnInput("run_subprocess_large_stdout", 5));

    const result = await subprocess.result("run_subprocess_large_stdout");

    assert.equal(result.status, "failed");
    assert.equal(result.error?.code, "SUBPROCESS_INVALID_RESULT");
    assert.ok(String(result.error?.details?.stdout).length < 66 * 1024);
  });

  it("expires and kills a child process after timeout", async () => {
    const subprocess = backend("subprocess-hang.mjs");
    await subprocess.spawn(spawnInput("run_subprocess_timeout", 1));

    const result = await subprocess.result("run_subprocess_timeout");

    assert.equal(result.status, "expired");
    assert.equal(result.error?.code, "SUBPROCESS_TIMEOUT");
  });

  it("keeps timeout status when a child emits a late agent_end", async () => {
    const subprocess = backend("subprocess-rpc-late-after-sigterm.mjs");
    await subprocess.spawn(spawnInput("run_subprocess_late_timeout", 1));

    const result = await subprocess.result("run_subprocess_late_timeout");

    assert.equal(result.status, "expired");
    assert.equal(result.error?.code, "SUBPROCESS_TIMEOUT");
  });

  it("cancels a running child process", async () => {
    const subprocess = backend("subprocess-hang.mjs");
    await subprocess.spawn(spawnInput("run_subprocess_cancel", 5));

    const status = await subprocess.cancel("run_subprocess_cancel", "No longer needed.");
    const result = await subprocess.result("run_subprocess_cancel");

    assert.equal(status.status, "cancelled");
    assert.equal(result.status, "cancelled");
    assert.match(result.summary, /No longer needed/);
  });

  it("rejects full parent context before spawning", async () => {
    const subprocess = backend("subprocess-rpc-success.mjs");
    const unsafe = { ...spawnInput("run_subprocess_full"), context: { mode: "full", files: [] } } as SpawnInput;

    await assert.rejects(() => subprocess.spawn(unsafe), /context\.mode full requires explicit policy approval/);
  });

  it("builds the hardened Pi RPC command without inherited project resources or bash", () => {
    const args = buildPiRpcArgs(spawnInput("run_subprocess_args"));

    assert.deepEqual(args, [
      "--mode",
      "rpc",
      "--no-session",
      "--no-approve",
      "--offline",
      "--no-context-files",
      "--no-extensions",
      "--no-skills",
      "--no-prompt-templates",
      "--no-themes",
      "--tools",
      "read,grep,find,ls",
    ]);
  });
});
