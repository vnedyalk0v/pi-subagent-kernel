# Test Plan and Quality Gates

## Test strategy

Test the runtime as pure TypeScript first. Use Pi integration tests only where required.

Test layers:

```text
unit tests       schemas, policies, state transitions, reducers
integration      kernel + fake backend + tool handlers
subprocess       real child process behavior with fixture command
Pi smoke         extension loads and tools are registered
end-to-end       optional real Pi subagent run in a fixture repo
```

## Unit tests

### Schemas

- Valid agent definition passes.
- Missing `name` fails.
- Missing `description` fails.
- Invalid name fails.
- Unknown runtime fails.
- Unknown context mode fails.
- Invalid permission value fails.
- Unknown tool input property fails.
- Valid result envelope passes.
- Invalid confidence range fails.

### State machine

- `queued -> starting -> running -> completed` passes.
- `queued -> cancelled` passes.
- `running -> cancelled` passes.
- `completed -> running` fails.
- `failed -> completed` fails.
- Timeout creates `expired`/failed terminal state according to implementation.

### Permission policy

- Reviewer cannot write.
- Scout cannot run shell by default.
- Tester can run allowed test command only if classifier allows it.
- Nested subagent denied by default.
- `maxDepth` clips child policy.
- Global lower budget overrides agent higher budget.
- Project-local agent blocked when project untrusted.

### Context builder

- `summary` mode includes summary but not full transcript.
- `none` mode excludes parent summary.
- `full` mode denied unless explicitly allowed.
- File hints are included.
- Large diff becomes artifact reference.

### Result reducer

- Valid JSON result becomes envelope.
- Free-text result becomes summary with raw artifact.
- Invalid schema returns validation error.
- Parallel results deduplicate findings by file/line/title.

## Integration tests

### Kernel + fake backend

- Spawn foreground scout and complete.
- Spawn background reviewer and poll status.
- Cancel running fake backend.
- Backend failure produces failed envelope.
- Concurrency limit queues excess jobs.

### Tool handlers

- `subagent_spawn` validates input.
- `subagent_status` returns active runs.
- `subagent_result` returns completed result.
- `subagent_cancel` cancels active run.
- Unknown run ID returns typed not-found error.

### Agent registry

- Built-ins load.
- User definition overrides built-in only if policy allows.
- Project definition overrides user only when trusted.
- Duplicate project files fail or select deterministic winner according to spec.

## Subprocess tests

Use a fixture child command, not real model calls, for CI.

Test cases:

- Child exits 0 with valid JSON.
- Child exits 0 with invalid JSON.
- Child exits nonzero.
- Child writes large stdout.
- Child writes stderr.
- Child sleeps past timeout.
- Cancellation kills child.
- Temporary files are cleaned.

## Worktree tests, phase 2

- Creates unique worktree.
- Records base commit.
- Child changes file in worktree.
- Parent working tree remains unchanged.
- Patch artifact includes changes.
- Cleanup removes worktree when policy says cleanup.
- Cleanup does not delete worktree if run failed and policy says retain.
- Concurrent write agents cannot use same branch/path unless allowed.

## Security regression tests

- Agent file cannot expand max depth beyond global cap.
- Agent file cannot enable network if global policy denies it.
- Imported Claude file with omitted tools does not get all tools by accident.
- Codex imported sandbox setting does not weaken parent policy.
- Project-local malicious-looking agent is not loaded without trust.
- Raw environment variables are not included in event log.
- Tool denial reason is visible to parent.

## Golden fixtures

Create fixtures:

```text
test/fixtures/agents/valid-scout.md
test/fixtures/agents/invalid-missing-name.md
test/fixtures/agents/claude-reviewer.md
test/fixtures/agents/codex-reviewer.toml
test/fixtures/results/review-valid.json
test/fixtures/results/review-invalid.json
test/fixtures/repos/simple-git-repo/
```

## CI gates

Before merge:

```text
npm run typecheck
npm run lint
npm test
```

Before release:

```text
npm run test:integration
npm run test:subprocess
manual Pi smoke test
package install test from tarball
```

## Manual smoke test

1. Install Pi and this extension in development mode.
2. Start a fixture repo.
3. Run `/agents`.
4. Ask parent to call `subagent_spawn` with `scout` on a small task.
5. Confirm result envelope shape.
6. Start background `reviewer` task.
7. Confirm `/agents` shows it.
8. Cancel one run.
9. Confirm no child process remains.

## Quality bar for reviewer findings

Reviewer tests should include false-positive pressure.

A finding is valid only when it has:

- Concrete evidence.
- File/symbol reference when available.
- User-visible or correctness impact.
- Suggested fix or verification step.

Do not reward vague style comments.
