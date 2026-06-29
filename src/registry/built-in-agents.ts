import { parseAgentDefinitions, type AgentDefinition } from "../contracts/agent-definition.ts";

const builtInAgentInputs = [
  {
    name: "scout",
    description: "Read-only codebase explorer for finding files, symbols, dependencies, and execution paths.",
    instructions: `You are a read-only codebase scout.

Your job is to gather evidence, not to fix code.

Rules:
- Do not edit files.
- Do not run shell commands.
- Prefer targeted search over broad scans.
- Return concise findings with file paths and symbols.
- State uncertainty when evidence is incomplete.`,
    runtime: "sdk",
    model: "inherit",
    thinking: "low",
    tools: ["read", "grep", "find", "ls"],
    permissions: {
      filesystem: "read-only",
      network: "none",
      shell: "none",
    },
    context: {
      inherit: "summary",
    },
    limits: {
      maxRuntimeSec: 900,
      maxTurns: 8,
      maxCostUsd: 0.25,
    },
    outputSchema: "research_notes_v1",
  },
  {
    name: "reviewer",
    description: "Reviews code changes for correctness, security, regressions, and missing tests.",
    instructions: `You are a strict code reviewer.

Focus on real issues:
- Correctness bugs.
- Security issues.
- Race conditions.
- Data loss.
- Behavior regressions.
- Missing tests for changed behavior.

Avoid style-only feedback unless it hides a real bug.
For each finding, include severity, title, file, line when available, evidence, and recommendation.`,
    runtime: "subprocess",
    model: "inherit",
    thinking: "high",
    tools: ["read", "grep", "find", "ls", "bash:test-only"],
    permissions: {
      filesystem: "read-only",
      network: "none",
      shell: "test-only",
    },
    context: {
      inherit: "summary",
    },
    limits: {
      maxRuntimeSec: 1800,
      maxTurns: 12,
      maxCostUsd: 1,
    },
    outputSchema: "review_findings_v1",
  },
  {
    name: "tester",
    description: "Runs or recommends focused validation for a scoped change.",
    instructions: `You are a test validation agent.

Your job is to identify and run focused validation, not broad unrelated test suites unless asked.

Return:
- Commands run.
- Pass/fail status.
- Relevant output only.
- Failing tests and likely cause.
- Suggested next validation.

Do not edit files.`,
    runtime: "subprocess",
    model: "inherit",
    thinking: "medium",
    tools: ["read", "grep", "find", "ls", "bash:test-only"],
    permissions: {
      filesystem: "read-only",
      network: "none",
      shell: "test-only",
    },
    context: {
      inherit: "summary",
    },
    limits: {
      maxRuntimeSec: 1800,
      maxTurns: 10,
      maxCostUsd: 0.75,
    },
    outputSchema: "test_report_v1",
  },
  {
    name: "summarizer",
    description: "Synthesizes multiple subagent results into one concise final answer.",
    instructions: `You are a result summarizer.

Use only the provided subagent results. Do not invent evidence.

Return:
- Consolidated summary.
- Deduplicated findings.
- Disagreements or uncertainty.
- Recommended next actions.`,
    runtime: "sdk",
    model: "inherit",
    thinking: "low",
    tools: [],
    permissions: {
      filesystem: "none",
      network: "none",
      shell: "none",
    },
    context: {
      inherit: "none",
    },
    limits: {
      maxRuntimeSec: 600,
      maxTurns: 4,
      maxCostUsd: 0.15,
    },
    outputSchema: "summary_v1",
  },
];

export const BUILT_IN_AGENT_DEFINITIONS: readonly AgentDefinition[] = Object.freeze(parseAgentDefinitions(builtInAgentInputs));
