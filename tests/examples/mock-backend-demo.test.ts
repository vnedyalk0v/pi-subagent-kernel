import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { before, describe, it } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

describe("examples", () => {
  before(async () => {
    await execFileAsync("npm", ["run", "build", "--silent"], { maxBuffer: 1024 * 1024 });
  });

  it("prints the documented spawn/status/result/cancel mock backend flow", async () => {
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

  it("prints the alpha dogfood flow for scout/reviewer/tester/summarizer", async () => {
    const { stdout } = await execFileAsync(process.execPath, ["examples/dogfood-alpha-scenario.mjs"], { maxBuffer: 1024 * 1024 });
    const dogfood = JSON.parse(stdout) as {
      scenario: string;
      backend: string;
      productionReadinessClaimed: boolean;
      agents: string[];
      acceptance: {
        scoutFoundRelevantFiles: boolean;
        reviewerProducedFindings: boolean;
        testerIdentifiedTestRisk: boolean;
        summarizerMergedResults: boolean;
      };
      results: Record<string, { status: string; findings: Array<{ title: string }>; filesRead: string[]; nextActions: string[] }>;
      followUpLedger: Array<{ signal: string; observed: boolean; followUpIssue: string | null }>;
    };

    assert.equal(dogfood.scenario, "alpha-dogfood-v1");
    assert.equal(dogfood.backend, "deterministic-subprocess-fixture");
    assert.equal(dogfood.productionReadinessClaimed, false);
    assert.deepEqual(dogfood.agents, ["scout", "reviewer", "tester", "summarizer"]);
    assert.deepEqual(dogfood.acceptance, {
      scoutFoundRelevantFiles: true,
      reviewerProducedFindings: true,
      testerIdentifiedTestRisk: true,
      summarizerMergedResults: true,
    });
    assert.equal(dogfood.results.scout.status, "completed");
    assert.ok(dogfood.results.scout.filesRead.includes("src/registry/built-in-agents.ts"));
    assert.equal(dogfood.results.reviewer.findings.length, 1);
    assert.equal(dogfood.results.tester.findings.length, 1);
    assert.deepEqual(
      dogfood.results.summarizer.findings.map((finding) => finding.title),
      [...dogfood.results.reviewer.findings, ...dogfood.results.tester.findings].map((finding) => finding.title),
    );
    assert.ok(dogfood.results.summarizer.nextActions.some((action) => action.includes("#61")));
    assert.deepEqual(dogfood.followUpLedger.map((item) => [item.signal, item.observed, item.followUpIssue]), [
      ["false-positive", false, null],
      ["failure", false, null],
      ["known-limitation", true, "#61"],
    ]);
  });
});
