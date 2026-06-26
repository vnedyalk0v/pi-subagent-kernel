# Runtime Backends

The system should support multiple execution backends behind one interface. Different tasks need different tradeoffs.

## Backend matrix

| Backend | Best for | Strengths | Risks | MVP? |
|---|---|---|---|---:|
| `sdk` | Fast read-only tasks, lightweight analysis | Low latency, same process, easy event integration | Weaker crash isolation; must prevent shared mutable state bugs | yes |
| `subprocess` | Safer isolated child Pi sessions | Crash isolation, cleaner process boundary, less shared state | Process startup overhead; more complex IPC and cancellation | yes |
| `worktree` | Write-capable implementation | Keeps edits isolated, supports diff review/merge | Git complexity, cleanup, conflicts | phase 2 |
| `mux` | Long-running interactive workers | User can attach/steer, good visibility | Terminal-specific behavior, harder automation | phase 2 |
| `remote` | Large fanout/cloud workers | Scales beyond local machine | Auth, security, networking, cost, observability | later |

## Backend selection

Default routing:

| Agent/task | Runtime default |
|---|---|
| `scout` | `sdk` |
| `planner` | `sdk` or `subprocess` |
| `reviewer` | `subprocess` |
| `tester` | `subprocess` |
| `implementer` | `worktree` after phase 2; `subprocess` in MVP with writes disabled unless explicit |
| `summarizer` | `sdk` |
| `security-auditor` | `subprocess` or `worktree` if running tools |

Backend selection algorithm:

```text
1. Start with spawn.runtime if provided.
2. Else use agent.runtime.
3. Else use policy default for agent role.
4. If selected backend is unavailable, ask BackendSelector for fallback.
5. Fallback must not reduce safety. Example: worktree -> subprocess read-only is allowed; worktree -> sdk workspace-write is not automatic.
```

## SDK backend

### Purpose

Run an isolated agent session inside the parent Pi process when the task is read-only or low-risk.

### Requirements

- Must isolate child message history from the parent conversation.
- Must use per-agent tool allowlist.
- Must support cancellation.
- Must emit lifecycle/progress events.
- Must return normalized result envelope.

### When to avoid

- Agent can write files.
- Agent can run risky shell commands.
- Agent needs crash isolation.
- Agent will run for a long time.
- Agent needs a different working directory with complex environment assumptions.

## Subprocess backend

### Purpose

Spawn a child Pi process for stronger isolation and independent lifecycle.

### Requirements

- Must pass task/context via safe stdin, temp file, or command argument with quoting handled carefully.
- Must use `AbortSignal` and process kill on cancellation.
- Must enforce timeout.
- Must capture stdout/stderr separately.
- Must parse structured output or fall back to artifacted raw output.
- Must avoid leaking secrets into command-line arguments where process lists can expose them.

### Open questions to verify locally

- Exact best Pi CLI mode for structured child execution in the installed version.
- Whether JSON/RPC/print modes expose enough metadata for streaming status.
- How to pass tool allowlists and model selection to child Pi in the current CLI.

Do not hardcode third-party package subprocess command lines without confirming current Pi behavior.

## Worktree backend

### Purpose

Run write-capable agents in an isolated git worktree so parent working tree remains stable.

### Requirements

- Create worktree from a known base ref.
- Use unique branch/worktree names per run.
- Record base commit, branch, worktree path, and changed files.
- Prevent two write agents from editing the same main worktree path unless explicitly allowed.
- Return patch/diff artifact.
- Clean up worktree only after user-approved retention policy.

### Worktree lifecycle

```text
allocate -> prepare -> run child -> collect diff -> result -> retain or cleanup
```

### Safety rules

- Do not auto-merge child changes into parent worktree.
- Do not run destructive git commands without explicit approval.
- If worktree creation fails, do not silently fall back to editing the parent tree.

## Mux/tmux backend

### Purpose

Support attachable, long-running subagents with visible terminal sessions.

### Requirements

- Detect available multiplexer safely.
- Spawn child with unique session/pane label.
- Record attach command as artifact/detail.
- Support cancellation/stop.
- Support steering only if the input channel is reliable.

### Supported multiplexers, phase 2+

- tmux first.
- zellij/WezTerm/cmix later only with users willing to test.

## Remote backend

Remote execution should wait until:

- Local kernel is stable.
- Result schema is stable.
- Permissions model is stable.
- Auth and secret handling are designed.
- Audit logs are available.

Do not include remote backend in MVP.

## Backend events

Backends should emit:

```text
run.queued
run.starting
run.started
run.progress
run.tool_call
run.tool_result
run.usage
run.waiting_for_input
run.completed
run.failed
run.cancelled
run.expired
artifact.created
```

Events must be structured. Human-readable status is derived from events, not stored as the only state.

## Cancellation requirements

- SDK: abort current model/tool calls through signal where possible.
- Subprocess: send graceful termination, then hard kill after grace period.
- Worktree: cancel child, collect partial diff if safe, mark worktree retained.
- Mux: send termination command or kill session/pane according to policy.

Cancellation must be idempotent.
