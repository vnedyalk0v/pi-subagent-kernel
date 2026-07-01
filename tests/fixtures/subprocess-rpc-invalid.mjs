process.stdin.once("data", () => {
  process.stdout.write(
    JSON.stringify({
      type: "diagnostic",
      summary: "SECRET_SUMMARY",
      details: { stderr: "SECRET_DETAILS" },
      data: { output: "SECRET_DATA" },
      findings: [{ evidence: "SECRET_EVIDENCE" }],
    }) + "\n",
  );
  process.stdout.write(JSON.stringify({ type: "turn_end", toolResults: [{ output: "SECRET_FILE_CONTENT" }] }) + "\n");
  process.stdout.write(JSON.stringify({ type: "agent_end", messages: [{ role: "assistant", content: [{ type: "text", text: "not json" }] }] }) + "\n");
});
