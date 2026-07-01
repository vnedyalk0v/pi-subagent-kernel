process.stdin.once("data", () => {
  process.stdout.write(JSON.stringify({ type: "response", command: "prompt", success: false, error: "bad config" }) + "\n");
});
