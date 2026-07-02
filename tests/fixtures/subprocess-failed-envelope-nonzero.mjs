process.stdin.once("data", () => {
  const envelope = {
    id: "failed_nonzero",
    agent: "fixture_agent",
    runtime: "subprocess",
    contextMode: "summary",
    status: "failed",
    startedAt: "2026-06-26T10:00:00.000Z",
    endedAt: "2026-06-26T10:00:00.001Z",
    summary: "structured child failure",
    findings: [],
    artifacts: [],
    filesRead: [],
    filesChanged: [],
    commandsRun: [],
    testsRun: [],
    cost: { estimatedUsd: null },
    confidence: 0,
    nextActions: [],
    error: { code: "CHILD_FAILED", message: "sensitive child stderr", retryable: true, details: { secret: "SECRET" } },
  };
  process.stdout.write(JSON.stringify(envelope), () => process.exit(2));
});
