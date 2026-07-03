import { fileURLToPath } from "node:url";

import {
  AgentRegistry,
  parsePermissionPolicy,
  parseSpawnInput,
  registerBuiltInAgents,
  SubprocessExecutionBackend,
} from "../dist/index.js";

const FIXED_TIME = "2026-06-26T10:00:00.000Z";

const registry = new AgentRegistry();
registerBuiltInAgents(registry);

const backend = new SubprocessExecutionBackend({
  command: process.execPath,
  args: [fileURLToPath(new URL("./dogfood-alpha-child.mjs", import.meta.url))],
  now: () => new Date(FIXED_TIME),
  killGraceMs: 10,
});

const scout = await runAgent("scout", "Find the files that define and test the current subagent workflow.", []);
const reviewer = await runAgent("reviewer", `Review the alpha dogfood surface using scout evidence:\n${JSON.stringify(slim(scout))}`, scout.filesRead);
const tester = await runAgent("tester", `Identify missing tests or test-risk using scout evidence:\n${JSON.stringify(slim(scout))}`, scout.filesRead);
const summarizer = await runAgent("summarizer", JSON.stringify({ scout: slim(scout), reviewer: slim(reviewer), tester: slim(tester) }), []);

const results = { scout: slim(scout), reviewer: slim(reviewer), tester: slim(tester), summarizer: slim(summarizer) };
const acceptance = {
  scoutFoundRelevantFiles: scout.filesRead.length >= 4,
  reviewerProducedFindings: reviewer.findings.length > 0,
  testerIdentifiedTestRisk: tester.findings.length > 0,
  summarizerMergedResults: summarizer.findings.length === reviewer.findings.length + tester.findings.length,
};
const failedRuns = Object.values(results).filter((result) => result.status === "failed" || result.status === "expired");
const failedAcceptance = Object.entries(acceptance).filter(([, passed]) => !passed).map(([name]) => name);
const scenarioFailed = failedRuns.length > 0 || failedAcceptance.length > 0;

console.log(JSON.stringify({
  scenario: "alpha-dogfood-v1",
  backend: "deterministic-subprocess-fixture",
  productionReadinessClaimed: false,
  agents: Object.keys(results),
  acceptance,
  results,
  followUpLedger: [
    {
      signal: "false-positive",
      observed: false,
      followUpIssue: null,
      note: "No false positives were observed in the deterministic run; no new follow-up issue was opened.",
    },
    {
      signal: "failure",
      observed: scenarioFailed,
      followUpIssue: scenarioFailed ? "new issue required" : null,
      note: scenarioFailed
        ? `Scenario failed: runs=${failedRuns.map((run) => run.agent).join(",") || "none"}; acceptance=${failedAcceptance.join(",") || "none"}.`
        : "No scenario failure was observed in the deterministic run; no new follow-up issue was opened.",
    },
    {
      signal: "known-limitation",
      observed: true,
      followUpIssue: "#26",
      note: "Live/manual Pi smoke coverage remains an alpha-readiness checklist item, not a production-readiness claim.",
    },
  ],
}, null, 2));

if (scenarioFailed) {
  process.exitCode = 1;
}

async function runAgent(name, task, files) {
  const agent = registry.get(name);
  if (!agent) {
    throw new Error(`Missing built-in agent ${name}.`);
  }

  const context = agent.inheritContext === "none"
    ? { mode: "none", files: [] }
    : {
        mode: agent.inheritContext,
        summary: "Alpha dogfood uses a deterministic local subprocess fixture; no model, network, or live Pi child is called.",
        files,
      };
  const input = parseSpawnInput({
    runId: `run_dogfood_${name}`,
    agent,
    task,
    context,
    policy: parsePermissionPolicy({
      filesystem: agent.sandbox.filesystem === "none" ? "none" : "read-only",
      shell: agent.sandbox.shell === "test-only" ? "test-only" : "none",
    }),
    limits: { maxRuntimeSec: 5 },
    output: {
      mode: agent.resultMode ?? "json",
      ...(agent.outputSchema !== undefined ? { schema: agent.outputSchema } : {}),
    },
  });

  await backend.spawn(input);
  return backend.result(input.runId);
}

function slim(result) {
  return {
    id: result.id,
    agent: result.agent,
    runtime: result.runtime,
    contextMode: result.contextMode,
    status: result.status,
    summary: result.summary,
    findings: result.findings,
    filesRead: result.filesRead,
    testsRun: result.testsRun,
    nextActions: result.nextActions,
  };
}
