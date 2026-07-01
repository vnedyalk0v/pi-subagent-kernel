process.stdin.resume();
process.on("SIGTERM", () => {
  const envelope = {
    id: "late_run",
    agent: "fixture_agent",
    runtime: "subprocess",
    contextMode: "summary",
    status: "completed",
    startedAt: "2026-06-26T10:00:00.000Z",
    endedAt: "2026-06-26T10:00:00.001Z",
    summary: "late completion should not win",
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
  process.stdout.write(JSON.stringify({ type: "agent_end", messages: [{ role: "assistant", content: [{ type: "text", text: JSON.stringify(envelope) }] }] }) + "\n");
});
setInterval(() => {}, 10_000);
