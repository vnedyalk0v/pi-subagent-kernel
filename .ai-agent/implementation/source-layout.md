# Recommended source layout

Read this before creating files or directories.

Use this layout unless an accepted issue or PR changes it:

```text
src/
  index.ts
  extension.ts
  contracts/
    agent-definition.ts
    run-envelope.ts
    run-state.ts
    run-event.ts
    permission-policy.ts
    execution-backend.ts
    artifacts.ts
    model-route.ts
    index.ts
  registry/
    agent-registry.ts
    run-registry.ts
  loaders/
    pi-agent-loader.ts
    claude-agent-loader.ts
    codex-agent-loader.ts
  backends/
    execution-backend.ts
    mock-backend.ts
    sdk-backend.ts
    subprocess-backend.ts
  tools/
    subagent-spawn.ts
    subagent-status.ts
    subagent-result.ts
    subagent-cancel.ts
  commands/
  permissions/
  context/
  observability/

tests/
  contracts/
  registry/
  loaders/
  backends/
  tools/
```

## Directory creation rule

Do not create directories for future features unless the current issue needs them.

For example:

- Do not create `commands/` until implementing commands.
- Do not create `observability/` until adding events/logging/inspection.
- Do not create `workflows/` under `src/` until workflow issues are active.
- Do not create `worktree-backend.ts` before the worktree milestone.

## Import/export style

- Keep contract exports centralized in `src/contracts/index.ts`.
- Avoid circular imports.
- Keep runtime-specific code out of `contracts/`.
- Tests should import public contract exports where possible.
