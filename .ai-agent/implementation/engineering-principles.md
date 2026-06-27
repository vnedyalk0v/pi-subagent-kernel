# Engineering principles

Read this before implementation work.

## Build narrow and staged

Do:

1. Build small modules with stable interfaces.
2. Add runtime validation for public inputs.
3. Add tests for success and failure cases.
4. Keep safety decisions in code and schemas, not only prompts.
5. Preserve context isolation by default.
6. Make result details structured and inspectable.
7. Keep docs in sync with implemented behavior.
8. Prefer deterministic behavior over prompt-only conventions.
9. Make errors actionable.
10. Keep dependency additions rare and justified.

Do not:

1. Build a full workflow/DAG engine before one-off subagent runs are stable.
2. Add remote workers before local backends are reliable.
3. Add worktree write behavior before permissions and run lifecycle are tested.
4. Add automatic proactive delegation in MVP.
5. Let child agents silently escalate permissions.
6. Pass the full parent transcript to a child unless explicitly requested through `inheritContext: full`.
7. Auto-install unknown packages, extensions, or MCP servers from agent definitions.
8. Publish to npm before the release milestone explicitly allows it.
9. Store active runs only in memory while claiming durability.
10. Copy features from third-party packages without tests and a migration path.

## Implementation style

- Prefer TypeScript types plus runtime validation where public input crosses a boundary.
- Prefer plain objects and explicit interfaces over framework-heavy abstractions.
- Keep public contracts stable and documented.
- Fail closed for safety-sensitive options.
- Treat stringly-typed runtime names, tool names, and permissions as untrusted input.
- Avoid hidden global mutable state except where an issue explicitly accepts in-memory MVP behavior.
- Keep public APIs easy to test without a real Pi runtime where possible.

## Error handling

Errors should explain:

- what failed
- which input caused it, if safe to show
- what the valid values are
- whether the failure is user config, runtime failure, or unsupported behavior

Do not leak secrets in errors.

## Documentation sync

When behavior changes, update docs in the same PR unless the issue explicitly says not to. Mark behavior as `Implemented`, `Planned`, or `Proposed` accurately.
