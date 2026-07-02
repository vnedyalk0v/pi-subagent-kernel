process.stdin.once("data", () => {
  const envelope = {
    id: "large_agent_end",
    agent: "fixture_agent",
    runtime: "subprocess",
    contextMode: "summary",
    status: "completed",
    startedAt: "2026-06-26T10:00:00.000Z",
    endedAt: "2026-06-26T10:00:00.001Z",
    summary: "large agent_end parsed",
    findings: [{ severity: "info", title: "large", evidence: "x".repeat(70 * 1024), recommendation: "none" }],
    artifacts: [],
    filesRead: [],
    filesChanged: [],
    commandsRun: [],
    testsRun: [],
    cost: { estimatedUsd: null },
    confidence: 1,
    nextActions: [],
  };
  process.stdout.write(JSON.stringify({ type: "agent_end", messages: [{ role: "assistant", content: JSON.stringify(envelope) }] }) + "\n");
});
