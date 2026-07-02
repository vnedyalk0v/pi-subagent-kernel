process.stdin.once("data", () => {
  const envelope = {
    id: "failed_details",
    agent: "fixture_agent",
    runtime: "subprocess",
    contextMode: "summary",
    status: "failed",
    startedAt: "2026-06-26T10:00:00.000Z",
    endedAt: "2026-06-26T10:00:00.001Z",
    summary: "child failed SECRET_SUMMARY",
    findings: [{ severity: "high", title: "SECRET_TITLE", evidence: "SECRET_EVIDENCE", recommendation: "SECRET_RECOMMENDATION" }],
    artifacts: [{ name: "SECRET_ARTIFACT", kind: "log", path: "SECRET_ARTIFACT_PATH" }],
    filesRead: ["SECRET_FILE_READ"],
    filesChanged: ["SECRET_FILE_CHANGED"],
    commandsRun: ["SECRET_COMMAND"],
    testsRun: ["SECRET_TEST"],
    cost: { estimatedUsd: null },
    confidence: 0,
    nextActions: ["SECRET_ACTION"],
    error: { code: "SECRET_CODE", message: "child failed SECRET_MESSAGE", retryable: false, details: { stderr: "SECRET_DETAILS" } },
  };
  process.stdout.write(JSON.stringify({ type: "agent_end", messages: [{ role: "assistant", content: JSON.stringify(envelope) }] }) + "\n");
});
