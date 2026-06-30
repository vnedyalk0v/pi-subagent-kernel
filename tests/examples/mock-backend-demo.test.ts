import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { describe, it } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("mock backend demo", () => {
  it("prints the documented spawn/status/result/cancel flow", async () => {
    await execFileAsync("npm", ["run", "build", "--silent"], { maxBuffer: 1024 * 1024 });

    const { stdout } = await execFileAsync(process.execPath, ["examples/mock-backend-demo.mjs"], { maxBuffer: 1024 * 1024 });
    const demo = JSON.parse(stdout) as {
      mockOnly: boolean;
      piRuntimeTested: boolean;
      operations: {
        spawn: { id: string; status: string; mode: string; mock: boolean };
        status: { id: string; agent: string; status: string };
        result: { id: string; agent: string; runtime: string; status: string; filesRead: string[]; commandsRun: string[] };
        cancel: { id: string; status: string; cancelled: boolean; backendCancel: { called: boolean } };
      };
    };

    assert.equal(demo.mockOnly, true);
    assert.equal(demo.piRuntimeTested, false);
    assert.equal(demo.operations.spawn.status, "completed");
    assert.equal(demo.operations.spawn.mode, "background");
    assert.equal(demo.operations.spawn.mock, true);
    assert.equal(demo.operations.status.id, demo.operations.spawn.id);
    assert.equal(demo.operations.status.agent, "scout");
    assert.equal(demo.operations.status.status, "completed");
    assert.equal(demo.operations.result.id, demo.operations.spawn.id);
    assert.equal(demo.operations.result.status, "completed");
    assert.equal(demo.operations.result.runtime, "sdk");
    assert.deepEqual(demo.operations.result.filesRead, ["README.md"]);
    assert.deepEqual(demo.operations.result.commandsRun, []);
    assert.equal(demo.operations.cancel.id, "run_demo_cancel");
    assert.equal(demo.operations.cancel.status, "cancelled");
    assert.equal(demo.operations.cancel.cancelled, true);
    assert.equal(demo.operations.cancel.backendCancel.called, false);
  });
});
