process.stdin.once("data", () => {
  process.stdout.write("x".repeat(70 * 1024));
  process.exit(0);
});
