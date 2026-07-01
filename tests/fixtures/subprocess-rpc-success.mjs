process.stdin.resume();
process.stdin.on("end", () => {
  const envelope = {
    id: "fixture_run",
    agent: "fixture_agent",
    runtime: "subprocess",
    contextMode: "summary",
    status: "completed",
    startedAt: "2026-06-26T10:00:00.000Z",
    endedAt: "2026-06-26T10:00:00.001Z",
    summary: "fixture completed",
    findings: [],
    artifacts: [],
    filesRead: ["README.md"],
    filesChanged: [],
    commandsRun: [],
    testsRun: [],
    cost: { estimatedUsd: null },
    confidence: 1,
    nextActions: [],
  };
  process.stderr.write("fixture stderr\n");
  process.stdout.write(JSON.stringify({ type: "agent_end", messages: [{ role: "assistant", content: [{ type: "text", text: JSON.stringify(envelope) }] }] }) + "\n");
});
