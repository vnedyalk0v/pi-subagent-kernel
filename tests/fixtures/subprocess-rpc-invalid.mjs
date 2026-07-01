process.stdin.once("data", () => {
  process.stdout.write(JSON.stringify({ type: "agent_end", messages: [{ role: "assistant", content: [{ type: "text", text: "not json" }] }] }) + "\n");
});
