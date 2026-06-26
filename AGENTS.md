# Instructions for AI Coding Agents

These are repository-level instructions for Codex, Claude Code, Pi, Cursor, or any other AI coding agent used to implement this project.

## Ground rules

1. Read `docs/00-source-basis.md` before making architecture claims.
2. Treat source-backed facts and design recommendations differently.
3. Do not invent Pi APIs. If an API name is not in the current Pi docs or installed package typings, inspect the installed dependencies before using it.
4. Prefer a minimal MVP over a broad unfinished framework.
5. Every public tool, command, schema, and lifecycle state must have tests.
6. Safety defaults must be deny-by-default for nested agents, write access, network access, MCP servers, and project-local agent definitions.
7. Do not let child agents silently escalate permissions beyond the parent request.
8. Do not pass the full parent transcript to a child unless the caller explicitly requests `inheritContext: full`.
9. Do not add automatic proactive delegation in MVP. The parent agent must call the subagent tool explicitly.
10. All long-running work must support cancellation through an `AbortSignal` or equivalent process kill path.

## Definition of done

A feature is done only when:

- The behavior is described in Markdown docs or inline comments.
- Runtime validation rejects invalid input with a clear error.
- Unit tests cover success and failure cases.
- Integration tests cover at least one real or simulated Pi extension flow.
- Result details are structured and inspectable.
- No logs include secrets, raw API keys, or hidden chain-of-thought content.

## Implementation style

Use small modules with stable interfaces:

```text
src/
├── index.ts                 # Pi extension entrypoint
├── kernel/                  # runtime-neutral orchestration
├── backends/                # sdk, subprocess, worktree, mux
├── registry/                # agent discovery and validation
├── tools/                   # Pi tool handlers
├── commands/                # slash commands and UI
├── permissions/             # policy evaluator
├── context/                 # context builders and reducers
├── observability/           # events, logs, run store
├── schemas/                 # TypeBox/Zod schemas
└── test/                    # test helpers
```

Prefer explicit TypeScript types and runtime schemas. Do not rely on prompt-only conventions for safety or routing.

## Coding priorities

Build in this order:

1. Static schemas and validation.
2. Run registry and lifecycle state machine.
3. SDK backend with fake provider/test harness.
4. Subprocess backend with timeout and cancellation.
5. Tool API.
6. Agent definition loader.
7. Permissions policy.
8. Basic `/agents` status command.
9. Worktree backend.
10. Compatibility importers.

## Things not to do in MVP

- Do not build a full workflow/DAG engine before one-off subagent runs are stable.
- Do not add remote workers before local backends are reliable.
- Do not use global mutable singleton state that cannot be reconstructed on session resume.
- Do not store active runs only in memory if the UI claims they are durable.
- Do not auto-install unknown packages or MCP servers from agent definitions.
- Do not copy all features from an existing package without tests and a migration path.

## Research update policy

If you need to rely on a current external fact, check the upstream docs or source code and update `docs/00-source-basis.md`. Mark the source, access date, and whether the fact is verified from official docs, package README, source code, or local inspection.
