# Requirements

This document uses RFC-style keywords informally: **MUST**, **SHOULD**, and **MAY**.

## Functional requirements

### Agent registry

- MUST load built-in agent definitions.
- MUST load user-level agent definitions.
- MUST load project-level agent definitions only when project trust policy allows it.
- MUST validate all agent definitions before registration.
- MUST reject duplicate agent names at the same priority level.
- SHOULD support deterministic priority order.
- SHOULD expose a diagnostic command showing which definition won and why.
- MAY import Claude Markdown/YAML and Codex TOML definitions through compatibility adapters.

### Run registry

- MUST assign every run a stable run ID.
- MUST track lifecycle state.
- MUST store task, agent name, runtime backend, start time, end time, status, result summary, error details, and artifact references.
- MUST support cancellation.
- SHOULD persist completed run metadata to disk.
- SHOULD support replay/inspect for recent runs.
- MAY persist full child transcript only when configured and safe to do so.

### Tool API

MVP tools:

- MUST provide `subagent_spawn`.
- MUST provide `subagent_status`.
- MUST provide `subagent_result`.
- MUST provide `subagent_cancel`.

Post-MVP tools:

- SHOULD provide `subagent_steer`.
- SHOULD provide `subagent_artifact`.
- MAY provide compatibility aliases: `subagent`, `Agent`, and `Task`.

### Commands and UI

- MUST provide `/agents` or equivalent command for status.
- MUST show queued/running/completed/failed/cancelled states.
- MUST avoid dumping child transcripts into the main conversation by default.
- SHOULD provide inspect and cancel actions.
- MAY provide FleetView-style interactive navigation after the core runtime is stable.

### Execution backends

MVP:

- MUST implement an SDK/in-process backend or a well-isolated mock if the installed Pi SDK API requires adaptation.
- MUST implement a subprocess backend for stronger isolation.

Post-MVP:

- SHOULD implement a worktree backend for write-capable implementation agents.
- SHOULD implement mux/tmux attachable sessions for long-running interactive work.
- MAY implement remote workers after local backends are reliable.

### Context handling

- MUST default to context isolation.
- MUST support `inheritContext: none` and `inheritContext: summary`.
- SHOULD support `inheritContext: fork` when the backend can safely branch or copy context.
- MAY support `inheritContext: full` only with explicit caller selection and policy approval.
- MUST record which context mode was used in result details.

### Permissions

- MUST enforce per-agent tool allowlists.
- MUST deny nested subagent spawning by default.
- MUST enforce `maxDepth`.
- MUST enforce `maxThreads`.
- MUST enforce runtime timeout.
- SHOULD enforce token/cost budgets when provider usage data is available.
- SHOULD restrict MCP access per agent.
- SHOULD restrict network access by policy where possible.
- SHOULD require confirmation before using project-local agent definitions.

### Result envelope

Every backend MUST return a normalized result envelope:

```json
{
  "id": "run_...",
  "agent": "reviewer",
  "runtime": "subprocess",
  "contextMode": "summary",
  "status": "completed",
  "startedAt": "2026-06-26T10:00:00.000Z",
  "endedAt": "2026-06-26T10:03:00.000Z",
  "summary": "Concise final answer.",
  "findings": [],
  "artifacts": [],
  "filesRead": [],
  "filesChanged": [],
  "testsRun": [],
  "cost": {
    "estimatedUsd": null
  },
  "confidence": 0.8,
  "nextActions": []
}
```

A failed run MUST return a structured error envelope rather than an untyped thrown string.

## Non-functional requirements

### Safety

- Deny by default when policy is ambiguous.
- No unbounded recursion.
- No hidden permission escalation.
- No auto-installation from untrusted project files.
- No background processes started during extension factory initialization.
- All background resources must be closed during session shutdown.

### Reliability

- A child crash must not crash the parent process.
- Subprocesses must be killed on cancellation or timeout.
- Worktree cleanup must be idempotent.
- Result persistence must handle interrupted writes.
- Status commands must handle stale run records gracefully.

### Performance

- SDK read-only runs should avoid process startup when safe.
- Subprocess backend should stream progress or periodic heartbeats.
- Tool schemas should be concise enough not to bloat the parent prompt.
- Large child outputs must be summarized or artifacted, not injected wholesale.

### Maintainability

- Runtime core must not depend on TUI rendering.
- Backends must implement a shared interface.
- Compatibility importers must be optional modules.
- Permissions policy must be testable without launching Pi.
- Use stable schemas for tool inputs and outputs.

## MVP acceptance checklist

- [ ] Package installs as a Pi extension in development mode.
- [ ] `subagent_spawn` can run a built-in `scout` agent.
- [ ] `subagent_spawn` can run a built-in `reviewer` agent.
- [ ] Background run returns a run ID immediately.
- [ ] `/agents` shows background status.
- [ ] `subagent_result` retrieves final result.
- [ ] `subagent_cancel` cancels a running job.
- [ ] Invalid agent definition is rejected with a precise error.
- [ ] Project-local agent definitions require trust/confirmation.
- [ ] Tool allowlist prevents reviewer from editing files.
- [ ] Nested subagents are blocked by default.
- [ ] Timeout is enforced.
- [ ] Result envelope validates against schema.
- [ ] Unit and integration tests pass.
