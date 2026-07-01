process.stdin.once("data", () => {
  const envelope = {
    id: "large_then_result",
    agent: "fixture_agent",
    runtime: "subprocess",
    contextMode: "summary",
    status: "completed",
    startedAt: "2026-06-26T10:00:00.000Z",
    endedAt: "2026-06-26T10:00:00.001Z",
    summary: "result after large line",
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
  process.stdout.write("x".repeat(70 * 1024) + "\n" + JSON.stringify({ type: "agent_end", messages: [{ role: "assistant", content: [{ type: "text", text: JSON.stringify(envelope) }] }] }) + "\n");
});
