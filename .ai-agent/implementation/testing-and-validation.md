# Testing and validation

Use this file when writing or changing code, tests, CI, public contracts, runtime validation, tooling, or behavior.

## Local validation

If `package.json` exists, run:

```bash
npm run typecheck --if-present
npm run lint --if-present
npm run test --if-present
npm run build --if-present
```

For docs-only changes, at minimum run:

```bash
git diff --check
```

Do not claim a command passed unless you ran it and saw a passing result.

## Required test posture

Add tests for:

- Public types/schemas.
- Runtime validation success and failure.
- Invalid inputs.
- Safety defaults.
- Lifecycle states.
- Cancellation paths when implemented.
- Error messages where they affect users or agents.

## Safety regression tests

Tests must protect these defaults:

```text
maxDepth = 1
maxThreads = 4
nestedSubagents = false
filesystem = read-only
network = none
childExtensions = deny-by-default
mcpServers = allowlist-only
projectAgentsRequireConfirmation = true
```

Any PR that relaxes these defaults needs explicit issue/owner authority and tests proving the new behavior.

## Do not weaken tests

Do not make CI pass by:

- Deleting failing tests.
- Skipping failing tests.
- Weakening assertions.
- Removing safety checks.
- Updating snapshots without verifying behavior.
- Turning type errors into `any`.
- Suppressing lint errors broadly.

If a test is wrong, explain why in the PR and replace it with a better test.

## Validation evidence

Use `.ai-agent/templates/validation-evidence.md` when documenting validation.

## CI failure

If CI fails, switch to `.ai-agent/workflows/ci-failure-triage.md`.
