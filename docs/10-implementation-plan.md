# Implementation Plan

## Phase 0 — Repository scaffold

Deliverables:

- TypeScript package scaffold.
- Pi extension manifest in `package.json`.
- Test framework.
- Lint/typecheck scripts.
- Minimal extension entrypoint that loads without registering risky behavior.
- Source docs copied into repo.

Suggested scripts:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
}
```

Adjust tooling to project preference. Do not add heavy tooling if it slows MVP.

## Phase 1 — Schemas and state machine

Deliverables:

- Agent definition schema.
- Spawn/status/result/cancel tool schemas.
- Result envelope schema.
- Error envelope schema.
- Run lifecycle state machine.
- Unit tests for validation and invalid state transitions.

Tasks:

- Implement `schemas/agent.ts`.
- Implement `schemas/tools.ts`.
- Implement `schemas/result.ts`.
- Implement `kernel/run-state.ts`.
- Implement stable `runId` generation.

Acceptance:

- Invalid unknown tool input is rejected.
- Invalid agent file reports precise path and field.
- Invalid lifecycle transition throws typed error.

## Phase 2 — Agent registry

Deliverables:

- Built-in definitions.
- Markdown/YAML parser.
- User/project discovery abstraction.
- Trust-aware project load gate.
- `/agents config` or diagnostic output.

Tasks:

- Implement `registry/loadMarkdownAgent()`.
- Implement `registry/normalizeAgentSpec()`.
- Implement duplicate-resolution logic.
- Implement source metadata.

Acceptance:

- Built-in agents load.
- User agents load.
- Project agents are blocked without trust.
- Duplicate names show deterministic winner.

## Phase 3 — Kernel and SDK backend

Deliverables:

- Kernel spawn flow.
- SDK backend with fake/test provider harness if real SDK needs adaptation.
- Context builder.
- Permission policy MVP.
- Foreground result flow.

Tasks:

- Implement `kernel/SubAgentKernel`.
- Implement `backends/sdk`.
- Implement `context/buildChildPrompt()`.
- Implement `permissions/evaluatePolicy()`.
- Implement `result/reduceBackendResult()`.

Acceptance:

- `scout` can complete a fake SDK run in tests.
- Permission denies edit/write for reviewer.
- Context builder excludes parent transcript by default.

## Phase 4 — Pi tool integration

Deliverables:

- `subagent_spawn`.
- `subagent_status`.
- `subagent_result`.
- `subagent_cancel`.
- Minimal `/agents` command.

Tasks:

- Register tools in extension entrypoint.
- Wire tool handlers to kernel.
- Store tool result details for inspection.
- Add cancellation path.

Acceptance:

- Extension loads with Pi development flag.
- Foreground run returns envelope.
- Background run returns run ID.
- Status command lists running/completed runs.
- Cancellation works in tests.

## Phase 5 — Subprocess backend

Deliverables:

- Subprocess backend.
- Timeout enforcement.
- Output parser.
- Process kill on cancel.
- stderr/stdout artifact capture.

Tasks:

- Verify current Pi CLI structured execution mode locally.
- Implement safe child invocation.
- Avoid secrets in process args.
- Implement temporary input file cleanup.
- Implement structured output contract.

Acceptance:

- Child crash returns failed envelope.
- Timeout kills child.
- Cancel kills child.
- Raw output is artifacted if parsing fails.

## Phase 6 — Observability and persistence

Deliverables:

- Event JSONL.
- Artifact store.
- Completed run persistence.
- `/agents inspect`.
- Basic usage/cost fields when available.

Acceptance:

- Completed run can be inspected after command returns.
- Artifacts are referenced, not dumped.
- Events do not include secrets or hidden reasoning.

## Phase 7 — Worktree backend

Deliverables:

- Worktree allocator.
- Patch artifact collection.
- Write-capable implementer path.
- Cleanup/retain policy.

Acceptance:

- Implementer modifies only worktree.
- Parent tree remains unchanged.
- Patch artifact is generated.
- Cleanup is idempotent.

## Phase 8 — Compatibility importers

Deliverables:

- Claude Markdown/YAML importer.
- Codex TOML importer.
- OpenCode-style permissions importer if desired.
- Diagnostics for lossy fields.

Acceptance:

- Imported Claude agent preserves name, description, tools, model, body.
- Imported Codex agent preserves name, description, developer instructions, model, sandbox mode.
- Unmapped fields are reported.

## Phase 9 — Advanced orchestration

Only after MVP stability:

- Parallel fanout/fanin.
- Summarizer/reducer agents.
- CSV/batch processing.
- Deep research workflow.
- FleetView-style UI.
- Mux/tmux backend.
- Remote workers.

## Implementation sequencing for AI coding agent

Use small pull requests:

1. `feat: add schemas and run state machine`
2. `feat: add agent registry and built-ins`
3. `feat: add kernel and fake sdk backend`
4. `feat: register spawn/status/result/cancel tools`
5. `feat: add subprocess backend`
6. `feat: add artifact store and inspect command`
7. `feat: add worktree backend`
8. `feat: add compatibility importers`

Do not mix UX, backends, and permissions in one giant change.
