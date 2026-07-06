#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const sourceExtension = join(projectRoot, "src/index.ts");
const sourceTools = join(projectRoot, "src/tools/subagent-tools.ts");
const markerPrefix = "ALPHA_PI_SMOKE:";

const requiredTools = ["subagent_spawn", "subagent_status", "subagent_result", "subagent_cancel"];
const piBaseArgs = [
  "-p",
  "--offline",
  "--no-session",
  "--no-context-files",
  "--no-skills",
  "--no-prompt-templates",
  "--no-themes",
  "--no-extensions",
  "--no-approve",
];
const piEnv = { ...process.env, PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1", PI_TELEMETRY: "0" };
const tempDir = await mkdtemp(join(tmpdir(), "pi-subagent-kernel-alpha-smoke-"));

try {
  const piVersion = (await run("pi", ["--version"], { timeoutMs: 10_000 })).stdout.trim();
  const loadProbe = join(tempDir, "load-check.ts");
  await writeFile(loadProbe, loadProbeSource(), "utf8");

  const directLoad = await runPiAndReadMarker([
    ...piBaseArgs,
    "-e",
    sourceExtension,
    "-e",
    loadProbe,
    "/alpha-load-check",
  ]);

  const flowProbe = join(tempDir, "tool-flow.ts");
  await writeFile(flowProbe, toolFlowProbeSource(), "utf8");

  const toolFlow = await runPiAndReadMarker([
    ...piBaseArgs,
    "-e",
    flowProbe,
    "/alpha-tool-flow",
  ]);

  const summary = {
    piVersion,
    productionReadinessClaimed: false,
    realModelSmoke: false,
    network: "offline",
    directLoad,
    toolFlow,
  };

  assert(directLoad.requiredToolsRegistered, "Pi did not expose every required subagent tool.");
  assert(requiredTools.every((name) => directLoad.activeSubagentTools.includes(name)), "Pi did not activate every required subagent tool.");
  assert(requiredTools.every((name) => toolFlow.capturedTools.includes(name)), "The project extension did not register every required tool.");
  assert(toolFlow.spawn.status === "completed" && toolFlow.spawn.mock === true, "spawn did not complete through the mock backend.");
  assert(toolFlow.status.status === "completed", "status did not report the completed run.");
  assert(toolFlow.result.status === "completed" && toolFlow.result.runtime === "sdk", "result did not report the expected mock SDK run.");
  assert(toolFlow.registeredCancel.status === "completed" && toolFlow.registeredCancel.cancelled === false, "registered cancel tool did not inspect the completed run.");
  assert(toolFlow.cancel.status === "cancelled" && toolFlow.cancel.cancelled === true, "queued cancel did not record cancelled status.");

  console.log(JSON.stringify(summary, null, 2));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

function loadProbeSource() {
  return `
export default function(pi) {
  pi.registerCommand("alpha-load-check", {
    description: "Verify Pi SubAgent Kernel tool registration.",
    handler: async (_args, ctx) => {
      const required = ${JSON.stringify(requiredTools)};
      const allTools = pi.getAllTools().map((tool) => tool.name);
      const activeTools = pi.getActiveTools();
      const subagentTools = allTools.filter((name) => name.startsWith("subagent_"));
      const requiredToolsRegistered = required.every((name) => allTools.includes(name));
      process.stderr.write(${JSON.stringify(markerPrefix)} + JSON.stringify({
        requiredToolsRegistered,
        subagentTools,
        activeSubagentTools: activeTools.filter((name) => name.startsWith("subagent_")),
      }) + "\\n");
      ctx.shutdown();
    },
  });
}
`;
}

function toolFlowProbeSource() {
  const toolsUrl = pathToFileURL(sourceTools).href;

  return `
import { createSubagentToolServices, registerSubagentTools } from ${JSON.stringify(toolsUrl)};

export default function(pi) {
  const captured = [];
  const services = createSubagentToolServices();
  registerSubagentTools({
    registerTool(tool) {
      captured.push(tool);
      pi.registerTool(tool);
    },
  }, services);

  pi.registerCommand("alpha-tool-flow", {
    description: "Exercise Pi SubAgent Kernel mock tool flow.",
    handler: async (_args, ctx) => {
      const registeredDefinition = (name) => {
        const tool = captured.find((item) => item.name === name);
        if (!tool) throw new Error(\`Missing captured tool \${name}.\`);
        return tool;
      };

      // Pi exposes active tool metadata, but model-free command code must call the registered definition directly.
      const spawn = await registeredDefinition("subagent_spawn").execute("alpha_spawn", {
        agent: "scout",
        task: "Alpha smoke: inspect README.md without a model call.",
        mode: "background",
        context: { inherit: "summary", files: ["README.md"] },
      });
      const runId = spawn.details.id;
      const status = await registeredDefinition("subagent_status").execute("alpha_status", { id: runId });
      const result = await registeredDefinition("subagent_result").execute("alpha_result", { id: runId, includeArtifacts: true });
      const registeredCancel = await registeredDefinition("subagent_cancel").execute("alpha_registered_cancel", {
        id: runId,
        reason: "Verify the Pi-registered cancel handler on a completed run.",
      });

      services.runs.create({ id: "run_alpha_cancel", agent: "tester", task: "Queue a cancellable alpha smoke run." });
      const cancel = await registeredDefinition("subagent_cancel").execute("alpha_cancel", {
        id: "run_alpha_cancel",
        reason: "Alpha smoke cancellation.",
      });

      process.stderr.write(${JSON.stringify(markerPrefix)} + JSON.stringify({
        capturedTools: captured.map((tool) => tool.name),
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
          cost: result.details.result?.cost,
        },
        registeredCancel: {
          id: registeredCancel.details.id,
          status: registeredCancel.details.status,
          cancelled: registeredCancel.details.cancelled,
        },
        cancel: {
          id: cancel.details.id,
          status: cancel.details.status,
          cancelled: cancel.details.cancelled,
          backendCancel: cancel.details.backendCancel,
        },
      }) + "\\n");
      ctx.shutdown();
    },
  });
}
`;
}

async function runPiAndReadMarker(args) {
  const { stderr } = await run("pi", args, { timeoutMs: 20_000 });
  const markerLine = stderr.split(/\r?\n/).find((line) => line.startsWith(markerPrefix));
  if (!markerLine) {
    throw new Error(`Pi smoke marker was not found. stderr:\n${stderr}`);
  }
  return JSON.parse(markerLine.slice(markerPrefix.length));
}

async function run(command, args, { timeoutMs }) {
  // pi -p waits on inherited stdin; spawn lets this smoke close it.
  const child = spawn(command, args, { cwd: projectRoot, env: piEnv, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });

  const terminate = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
  const forceKill = setTimeout(() => child.kill("SIGKILL"), timeoutMs + 1_000);

  let rejectTimeout;
  const timeout = new Promise((_, reject) => {
    rejectTimeout = setTimeout(() => reject(new Error(`${command} timed out after ${timeoutMs}ms. stdout:\n${stdout}\nstderr:\n${stderr}`)), timeoutMs + 2_000);
  });

  try {
    const [code, signal] = await Promise.race([once(child, "close"), timeout]);
    if (code !== 0) {
      throw new Error(`${command} exited with ${code ?? signal}. stdout:\n${stdout}\nstderr:\n${stderr}`);
    }
    return { stdout, stderr };
  } finally {
    clearTimeout(terminate);
    clearTimeout(forceKill);
    clearTimeout(rejectTimeout);
  }
}
