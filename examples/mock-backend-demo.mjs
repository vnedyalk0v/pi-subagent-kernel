import { BUILT_IN_AGENT_DEFINITIONS, MockExecutionBackend } from "../dist/index.js";

const scout = BUILT_IN_AGENT_DEFINITIONS.find((agent) => agent.name === "scout");
if (!scout) {
  throw new Error("Built-in scout agent is missing.");
}

const backend = new MockExecutionBackend({ now: () => new Date("2026-06-26T10:00:00.000Z") });
const input = {
  runId: "run_demo_mock",
  agent: scout,
  task: "Inspect README.md without calling an AI service.",
  context: { mode: "summary", parentRunId: null, files: ["README.md"] },
  policy: {},
  limits: { maxRuntimeSec: 60 },
  output: { mode: "json" },
};

await backend.spawn(input);
const result = await backend.result(input.runId);

console.log(JSON.stringify({
  id: result.id,
  agent: result.agent,
  runtime: result.runtime,
  status: result.status,
  summary: result.summary,
  filesRead: result.filesRead,
  commandsRun: result.commandsRun,
  cost: result.cost,
}, null, 2));
