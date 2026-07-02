import { createInterface } from "node:readline";

let commandCount = 0;

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) {
    return;
  }
  const command = JSON.parse(line);
  commandCount += 1;
  if (commandCount === 1) {
    if (command.type !== "set_thinking_level") {
      process.stderr.write(`expected thinking before prompt, got ${command.type}\n`);
      process.exit(2);
    }
    process.stdout.write(JSON.stringify({ type: "response", command: "set_thinking_level", success: true }) + "\n");
    return;
  }
  if (command.type !== "prompt") {
    process.stderr.write(`expected prompt after thinking, got ${command.type}\n`);
    process.exit(2);
  }
  process.stdout.write(JSON.stringify({
    type: "agent_end",
    messages: [{
      role: "assistant",
      content: JSON.stringify({
        id: "child-run-id",
        agent: "child-agent",
        runtime: "subprocess",
        contextMode: "summary",
        status: "completed",
        startedAt: "2026-06-26T10:00:00.000Z",
        endedAt: "2026-06-26T10:00:00.000Z",
        summary: "thinking applied",
        findings: [],
        artifacts: [],
        filesRead: [],
        filesChanged: [],
        commandsRun: [],
        testsRun: [],
        cost: { estimatedUsd: null },
        confidence: 0.8,
        nextActions: [],
      }),
    }],
  }) + "\n");
});
