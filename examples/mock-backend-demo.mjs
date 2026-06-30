import { AgentRegistry, registerBuiltInAgents, RunRegistry } from "../dist/index.js";
import { createSubagentTools } from "../dist/tools/subagent-tools.js";

const agents = new AgentRegistry();
registerBuiltInAgents(agents);

const runs = new RunRegistry({ now: () => new Date("2026-06-26T10:00:00.000Z") });
const tools = createSubagentTools({ agents, runs });
const getTool = (name) => {
  const tool = tools.find((item) => item.name === name);
  if (!tool) {
    throw new Error(`Missing ${name} tool.`);
  }
  return tool;
};

const spawn = await getTool("subagent_spawn").execute("demo_spawn", {
  agent: "scout",
  task: "Inspect README.md without calling an AI service.",
  mode: "background",
  context: { inherit: "summary", files: ["README.md"] },
});

const runId = spawn.details.id;
const status = await getTool("subagent_status").execute("demo_status", { id: runId });
const result = await getTool("subagent_result").execute("demo_result", { id: runId, includeArtifacts: true });

runs.create({ id: "run_demo_cancel", agent: "tester", task: "Queue a cancellable mock run." });
const cancel = await getTool("subagent_cancel").execute("demo_cancel", {
  id: "run_demo_cancel",
  reason: "Demo cancellation.",
});

console.log(JSON.stringify({
  mockOnly: true,
  piRuntimeTested: false,
  limitation: "This demo exercises local in-memory tool handlers and MockExecutionBackend only; it does not start Pi, a subprocess, a model call, or a network request.",
  operations: {
    spawn: {
      id: runId,
      mode: spawn.details.mode,
      status: spawn.details.status,
      mock: spawn.details.mock,
    },
    status: {
      id: status.details.id,
      agent: status.details.run.agent,
      status: status.details.status,
      summary: status.details.run.summary,
    },
    result: {
      id: result.details.id,
      agent: result.details.result?.agent,
      runtime: result.details.result?.runtime,
      status: result.details.status,
      filesRead: result.details.result?.filesRead,
      commandsRun: result.details.result?.commandsRun,
      cost: result.details.result?.cost,
    },
    cancel: {
      id: cancel.details.id,
      status: cancel.details.status,
      cancelled: cancel.details.cancelled,
      backendCancel: cancel.details.backendCancel,
    },
  },
}, null, 2));
