process.stdin.once("data", () => {
  const envelope = {
    id: "failed_details",
    agent: "fixture_agent",
    runtime: "subprocess",
    contextMode: "summary",
    status: "failed",
    startedAt: "2026-06-26T10:00:00.000Z",
    endedAt: "2026-06-26T10:00:00.001Z",
    summary: "child failed",
    findings: [],
    artifacts: [],
    filesRead: [],
    filesChanged: [],
    commandsRun: [],
    testsRun: [],
    cost: { estimatedUsd: null },
    confidence: 0,
    nextActions: [],
    error: { code: "CHILD_FAILED", message: "child failed", retryable: false, details: { stderr: "SECRET" } },
  };
  process.stdout.write(JSON.stringify({ type: "agent_end", messages: [{ role: "assistant", content: JSON.stringify(envelope) }] }) + "\n");
});
