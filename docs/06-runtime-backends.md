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

### Local verification for subprocess alpha

Verified locally during issue #23 on 2026-07-01 with `@earendil-works/pi-coding-agent` 0.80.3.

Preferred child command shape for the alpha is RPC mode, with project resources disabled unless explicitly allowed by policy:

```bash
PI_TELEMETRY=0 pi --mode rpc --no-session --no-approve --offline \
  --no-context-files --no-extensions --no-skills --no-prompt-templates --no-themes \
  --tools read,grep,find,ls
```

Use `--no-tools` for agents that need no tools. Use `--no-extensions -e <trusted-extension>` only for a kernel-owned guard extension; `--no-extensions` disables discovery but explicit `-e` paths still load.

Verified behavior:

- `--mode rpc` is the safest structured subprocess integration point. Commands are JSON lines on stdin; responses, session events, and extension UI requests are JSON lines on stdout.
- RPC output uses strict LF-delimited JSONL. Clients must split on `\n` only and strip optional trailing `\r`; do not use Node `readline`.
- RPC responses and events share stdout. Use command `id` fields for correlation; response order is not guaranteed if multiple commands are sent without waiting.
- `--mode json` is single-shot print mode with a session header as the first JSON line and session events after that. It has no stdin command channel after startup.
- `--no-session` produces an ephemeral child; RPC `get_state` omits `sessionFile`. Without `--no-session`, `get_state` reports the intended session file path, but the file may not exist until entries are written.
- Non-interactive modes do not show a project-trust prompt. `--no-approve` ignores project resources for that run; `--approve` trusts them.
- `--offline` disables Pi startup network operations such as update checks; it is not the kernel's child `network = none` policy.
- `--tools` allowlists only whole tool names. It cannot express the kernel's narrower `bash:test-only` policy by itself.
- RPC `abort_bash` cancelled a local long-running bash command and returned `{ "cancelled": true }`. SIGTERM to the Pi process exited with code 143.

### Remaining unknowns before a real Pi-child backend

- Active model-call cancellation via RPC `abort` was not exercised locally to avoid sending a live prompt to a provider.
- A safe way to expose `bash:test-only` needs either a kernel-owned guard extension, an OS/container sandbox, or bash disabled for the first subprocess alpha.
- Final prompt/result extraction should be validated with a live model smoke test before claiming real subprocess execution support.

### Implementation status for subprocess alpha

`SubprocessExecutionBackend` is implemented and exported behind the `ExecutionBackend` interface. It starts a child process, sends one RPC `prompt` command over stdin, parses RPC JSONL stdout for the final assistant text, validates that text as a `RunEnvelope`, captures bounded stdout/stderr for failure details, enforces `maxRuntimeSec` timeout, and terminates the child on cancellation. The default command uses the hardened RPC shape above, disables inherited project resources, and only passes whole read-only Pi tool names; `bash:test-only` remains disabled until a guard extension or sandbox exists.

The current tests use controlled Node fixture processes, not live model calls. Do not claim real Pi child execution support in user-facing docs until a live-model smoke test validates result extraction and cancellation behavior.

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
