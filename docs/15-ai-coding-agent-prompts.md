# AI Coding Agent Starter Prompts

Use these prompts in a new repo after copying this documentation pack.

## Prompt 1 — Scaffold the package

```text
Read AGENTS.md and docs/00-source-basis.md first.

Create the initial TypeScript package scaffold for a Pi extension implementing Pi SubAgents Next. Do not implement all features. Create package.json, tsconfig, test setup, src/index.ts, and module folders matching docs/03-architecture.md. Add a minimal extension entrypoint that can load and register no-op diagnostics only. Add tests that verify the package exports load. Do not invent Pi APIs; inspect installed package typings before registering real tools.
```

## Prompt 2 — Implement schemas

```text
Implement Phase 1 from docs/10-implementation-plan.md.

Add runtime schemas for agent definitions, spawn/status/result/cancel tool inputs, result envelope, error envelope, and lifecycle states. Add unit tests for valid and invalid examples. Do not register Pi tools yet. Keep schemas strict and reject unknown properties.
```

## Prompt 3 — Implement run registry

```text
Implement the RunRegistry and lifecycle state machine from docs/03-architecture.md and docs/10-implementation-plan.md.

Every run must have a stable ID, status, timestamps, agent name, runtime backend, optional result, optional error, and event list. Add tests for valid and invalid transitions, cancellation, timeout marking, and not-found handling.
```

## Prompt 4 — Implement agent registry

```text
Implement the AgentRegistry from docs/04-agent-definition-spec.md.

Support built-in Markdown agent definitions and parsing Markdown files with YAML frontmatter. Add source metadata, validation errors with file paths, deterministic duplicate behavior, and tests. Do not load project-local files unless the caller passes a trusted flag. Include example built-in scout/reviewer/tester/implementer/summarizer definitions.
```

## Prompt 5 — Implement permission policy

```text
Implement the MVP permission policy from docs/07-context-safety-permissions.md.

The policy must enforce maxDepth, maxThreads, runtime limits, nestedSubagents=false by default, read-only defaults, and per-agent tool allowlists. Add tests proving reviewer cannot write, scout cannot shell by default, project agents are blocked without trust, and full-context inheritance is denied unless explicitly allowed.
```

## Prompt 6 — Implement fake backend and kernel

```text
Implement SubAgentKernel with a fake backend for tests.

The kernel should validate spawn input, resolve agent, evaluate policy, create a run, call backend.start, normalize result, and update run state. Add foreground and background flows. Do not call real Pi models yet. Add integration tests for success, failure, cancellation, and concurrency limit behavior.
```

## Prompt 7 — Register real Pi tools

```text
Inspect the installed @earendil-works/pi-coding-agent extension typings and current Pi docs. Then register subagent_spawn, subagent_status, subagent_result, and subagent_cancel as Pi tools using the correct current API.

Wire handlers to the kernel. Keep tool descriptions concise. Store structured details. Add a minimal /agents command that lists active/recent runs. Add tests or a smoke script where possible.
```

## Prompt 8 — Implement subprocess backend

```text
Implement the subprocess backend from docs/06-runtime-backends.md.

First inspect the current Pi CLI modes and decide the safest structured child execution path. Do not put secrets into command-line arguments. Implement timeout, cancellation, stdout/stderr capture, JSON result parsing, raw artifact fallback, and tests using fixture child commands before testing real Pi child sessions.
```

## Prompt 9 — Add artifacts and inspect

```text
Implement ArtifactStore and /agents inspect.

Store result.json, events.jsonl, stderr/stdout artifacts, and optional patch/test-output artifacts under a run directory. Use atomic writes where practical. Do not log secrets or hidden reasoning. Add tests for artifact creation and retrieval.
```

## Prompt 10 — Worktree backend

```text
Implement the phase 2 worktree backend.

Create unique git worktrees for write-capable implementer runs. Never fall back to editing the parent worktree. Record base commit and changed files. Return a patch artifact. Retain worktree on failure. Add tests with a fixture git repo.
```

## Prompt 11 — Compatibility importers

```text
Implement compatibility importers from docs/12-compatibility.md.

Start with Claude Markdown/YAML, then Codex TOML. Preserve unsupported fields under compat metadata and emit diagnostics. Do not execute Claude hooks or auto-start MCP servers in MVP. Add fixtures and tests.
```

## Prompt 12 — Release hardening

```text
Run through docs/11-test-plan.md and docs/14-release-packaging.md.

Fix failures, update README with install/safety notes, add changelog, verify npm pack contents, and perform a manual Pi smoke test. Do not publish until cancellation, timeout, project trust, and permission tests pass.
```
