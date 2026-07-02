process.stdin.once("data", () => {
  const envelope = {
    id: "tool_result",
    agent: "fixture_agent",
    runtime: "subprocess",
    contextMode: "summary",
    status: "completed",
    startedAt: "2026-06-26T10:00:00.000Z",
    endedAt: "2026-06-26T10:00:00.001Z",
    summary: "tool result should not be accepted",
    findings: [],
    artifacts: [],
    filesRead: [],
    filesChanged: [],
    commandsRun: [],
    testsRun: [],
    cost: { estimatedUsd: null },
    confidence: 1,
    nextActions: [],
  };
  process.stdout.write(JSON.stringify({ type: "agent_end", messages: [{ role: "toolResult", content: JSON.stringify(envelope) }] }) + "\n");
});
