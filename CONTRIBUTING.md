# Contributing

Thanks for helping with Pi SubAgent Kernel.

## Before you start

- Read `AGENTS.md`.
- Work from an issue; keep one issue per branch and pull request.
- Use branch names like `issue-<number>/<short-kebab-summary>`.
- Keep changes small and source-backed.

## Local checks

For documentation-only changes, run:

```bash
git diff --check
```

When `package.json` exists, also run the available npm scripts:

```bash
npm run typecheck --if-present
npm run lint --if-present
npm run test --if-present
npm run build --if-present
```

If a script is unavailable, say so in the PR body.

## Pull requests

Use the pull request template. Link the issue with `Closes #<number>` when the PR should close it on merge.

## Safety

Do not commit secrets, credentials, private logs, hidden chain-of-thought, or unrelated user data. Do not publish to npm from a contribution PR.
