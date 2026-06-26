# Architecture

## Overview

pi-subagent-kernel should be a small runtime kernel exposed through a Pi extension.

```text
Pi main session
  |
  | calls subagent tools / commands
  v
SubAgent Extension
  |
  +-- AgentRegistry
  +-- RunRegistry
  +-- PermissionPolicy
  +-- ContextBuilder
  +-- ModelRouter
  +-- EventBus
  +-- ArtifactStore
  +-- ResultReducer
  |
  +-- SDK backend
  +-- Subprocess backend
  +-- Worktree backend
  +-- Mux backend
  +-- Remote backend, future only
```

The extension should expose a small tool surface to the parent agent. The kernel should remain usable by other extensions through an internal service API.

## Package decomposition

Recommended eventual packages:

```text
@pi-subagents/core        # runtime-neutral state machine, schemas, policies
@pi-subagents/extension   # Pi extension entrypoint, tools, commands, UI
@pi-subagents/backends    # optional backend implementations
@pi-subagents/compat      # Codex/Claude/OpenCode importers
@pi-subagents/workflows   # optional DAG/fanout workflows, post-MVP
```

For MVP, a single package is acceptable if modules are structured so they can split later.

## Runtime components

### AgentRegistry

Responsibilities:

- Load built-in definitions.
- Discover user and project definitions.
- Normalize Markdown/YAML, Claude-style Markdown, and later Codex TOML into one internal schema.
- Validate names, descriptions, tools, models, context modes, permissions, budgets, and output schemas.
- Return immutable agent specs to the kernel.

Do not let a child agent mutate its own spec at runtime.

### RunRegistry

Responsibilities:

- Allocate run IDs.
- Track lifecycle states.
- Store active controllers for cancellation.
- Persist completed run summaries.
- Reconcile stale runs after restart.

Lifecycle:

```text
queued -> starting -> running -> completed
                       |   |       
                       |   +------> failed
                       |           
                       +----------> cancelled

queued -> cancelled
running -> waiting_for_input -> running
running -> expired -> failed
```

Use a single source of truth for state transitions. Reject invalid transitions in tests.

### PermissionPolicy

Responsibilities:

- Calculate effective permissions from global settings, project settings, agent definition, spawn call, and runtime backend.
- Enforce depth, concurrency, runtime, tool, MCP, network, filesystem, and write policy.
- Produce human-readable denial reasons.

Policy must be deterministic and testable without launching a model.

### ContextBuilder

Responsibilities:

- Build child prompt/context from task, parent summary, selected files, constraints, and agent system prompt.
- Keep parent transcript out of child context unless explicitly requested.
- Attach artifacts rather than huge text where possible.
- Record the chosen context mode.

Context modes:

```text
none       # task + agent prompt only
summary    # task + compact parent/project summary; default
fork       # branch/copy supported context, backend-specific
full       # full parent transcript, explicit only
```

### ModelRouter

Responsibilities:

- Resolve agent model and thinking/effort from deterministic config.
- Apply fallback model if the configured model is unavailable.
- Track selected model in run details.
- Avoid letting prompt text override policy.

### EventBus

Responsibilities:

- Emit structured lifecycle, progress, tool, budget, and result events.
- Feed UI status and other extensions.
- Avoid leaking child transcript unless explicitly configured.

Events should be JSON-serializable.

### ArtifactStore

Responsibilities:

- Store run outputs that are too large or unsafe to inject into parent context.
- Store logs, patches, JSON results, test output, and optional transcript summaries.
- Use atomic writes.
- Avoid storing secrets in plaintext when avoidable.

Recommended layout:

```text
<config-dir-or-cache>/subagents/runs/<run-id>/
├── meta.json
├── result.json
├── events.jsonl
├── artifacts/
│   ├── patch.diff
│   └── test-output.txt
└── transcript-summary.md
```

Do not hardcode `.pi` for project config paths. Use Pi's current config-dir API or exported constants when available.

### ResultReducer

Responsibilities:

- Normalize backend-specific outputs into the standard result envelope.
- Validate output schema.
- For parallel runs, synthesize child results into a concise parent result.
- Preserve raw child output as an artifact when needed.

## Backend interface

All backends should implement this conceptual interface:

```ts
interface ExecutionBackend {
  readonly id: RuntimeBackendId;
  canRun(request: SpawnRequest, agent: AgentSpec, policy: EffectivePolicy): Promise<CanRunResult>;
  start(request: SpawnRequest, agent: AgentSpec, ctx: ExecutionContext): Promise<RunningHandle>;
}

interface RunningHandle {
  runId: string;
  cancel(reason?: string): Promise<void>;
  result: Promise<BackendResult>;
}
```

The exact TypeScript should be adjusted to the installed Pi SDK and chosen schema library.

## Data flow

```text
1. Parent calls subagent_spawn.
2. Tool handler validates input.
3. AgentRegistry resolves agent.
4. PermissionPolicy calculates effective policy.
5. RunRegistry creates queued run.
6. Backend selector chooses runtime.
7. ContextBuilder builds child context.
8. Backend starts child.
9. EventBus emits progress.
10. ResultReducer validates final result.
11. RunRegistry stores completion.
12. Parent receives concise envelope or run ID.
```

## State persistence

MVP can persist:

- Agent registry diagnostics.
- Completed run result envelope.
- Event JSONL.
- Artifacts.

MVP may keep active handles in memory, but must clearly mark active runs as non-resumable if the process exits. Do not advertise durable active runs until recovery is implemented.

## Failure model

| Failure | Required behavior |
|---|---|
| Agent definition parse error | Reject definition; show diagnostic; do not crash extension. |
| Unknown agent | Return validation error with available agents. |
| Permission denied | Return structured policy denial. |
| Timeout | Cancel/kill backend; mark run `expired` then `failed`. |
| Child process crash | Mark failed with exit code/stderr artifact. |
| Result schema invalid | Mark failed or partially completed with validation errors. |
| Parent cancellation | Propagate abort to child where possible. |
| Session shutdown | Cancel or detach according to backend policy; close resources. |

## Security boundary

This architecture improves control and isolation, but it is not a hardened sandbox. A local subprocess with filesystem access can still run code allowed by the OS user. Treat permissions as agent-harness policy, not as a substitute for containers, OS sandboxing, or code review.
