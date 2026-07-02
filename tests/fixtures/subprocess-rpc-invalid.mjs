process.stdin.once("data", () => {
  process.stdout.write(
    JSON.stringify({
      type: "diagnostic",
      id: "SECRET_ID",
      command: "SECRET_COMMAND",
      toolCallId: "SECRET_TOOL_CALL",
      status: "SECRET_STATUS",
      summary: "SECRET_SUMMARY",
      details: { stderr: "SECRET_DETAILS" },
      data: { output: "SECRET_DATA" },
      findings: [{ evidence: "SECRET_EVIDENCE" }],
    }) + "\n",
  );
  process.stdout.write(JSON.stringify({ type: "turn_end", toolResults: [{ output: "SECRET_FILE_CONTENT" }] }) + "\n");
  process.stdout.write(JSON.stringify({ type: "agent_end", messages: [{ role: "assistant", content: [{ type: "text", text: "not json" }] }] }) + "\n");
});
