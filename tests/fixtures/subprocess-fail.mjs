process.stdin.once("data", () => {
  process.stdout.write("partial stdout\n");
  process.stderr.write("fixture failed\n");
  process.exit(2);
});
