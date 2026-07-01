process.stdin.resume();
process.stdin.on("end", () => {
  process.stdout.write("partial stdout\n");
  process.stderr.write("fixture failed\n");
  process.exit(2);
});
