# Tool API

The public tool API should be small, stable, and schema-first.

## Canonical tools

MVP:

```text
subagent_spawn
subagent_status
subagent_result
subagent_cancel
```

Post-MVP:

```text
subagent_steer
subagent_artifact
subagent_list
```

Compatibility aliases, optional after MVP:

```text
subagent
Agent
Task
```

Aliases should call the canonical implementation internally.

## `subagent_spawn`

Purpose: start one or more subagent tasks.

### Input

```json
{
  "agent": "reviewer",
  "task": "Review the current diff for correctness and security risks.",
  "mode": "foreground",
  "runtime": "auto",
  "context": {
    "inherit": "summary",
    "files": ["src/auth/session.ts"],
    "includeDiff": true
  },
  "limits": {
    "maxRuntimeSec": 1800,
    "maxCostUsd": 1.0
  },
  "outputSchema": "review_findings_v1"
}
```

### Batch input

```json
{
  "tasks": [
    {
      "agent": "scout",
      "task": "Find auth/session code paths."
    },
    {
      "agent": "reviewer",
      "task": "Review the current diff."
    }
  ],
  "mode": "background",
  "join": "none"
}
```

### Fields

| Field | Required | Notes |
|---|---:|---|
| `agent` | yes for single | Agent name. |
| `task` | yes for single | Complete task prompt for child. |
| `tasks` | yes for batch | Array of single-task objects. |
| `mode` | no | `foreground` or `background`; default `foreground`. |
| `runtime` | no | `auto`, `sdk`, `subprocess`, `worktree`, `mux`, `remote`. |
| `context` | no | Context mode and file hints. |
| `limits` | no | Per-call limits clipped by global policy. |
| `outputSchema` | no | Schema name or inline schema. |
| `join` | no | `none`, `all`, or `synthesize`; MVP may support only `none` and foreground single. |

### Foreground output

Returns the standard result envelope.

### Background output

```json
{
  "id": "run_01J...",
  "status": "queued",
  "agent": "reviewer",
  "message": "Subagent started in background. Use subagent_status or /agents to inspect."
}
```

## `subagent_status`

Purpose: list or inspect run states.

### Input

```json
{
  "id": "run_01J...",
  "includeRecentEvents": true
}
```

If `id` is omitted, return active and recent runs.

### Output

```json
{
  "runs": [
    {
      "id": "run_01J...",
      "agent": "scout",
      "status": "running",
      "runtime": "sdk",
      "startedAt": "2026-06-26T10:00:00.000Z",
      "elapsedMs": 4312,
      "summary": "Searching auth call sites",
      "cost": {
        "estimatedUsd": 0.08,
        "inputTokens": 12000,
        "outputTokens": 1200
      }
    }
  ]
}
```

## `subagent_result`

Purpose: retrieve a completed or failed run result.

### Input

```json
{
  "id": "run_01J...",
  "includeArtifacts": false,
  "includeEvents": false
}
```

### Output

The standard result envelope, plus artifact references if requested.

## `subagent_cancel`

Purpose: cancel one run or a group of runs.

### Input

```json
{
  "id": "run_01J...",
  "reason": "No longer needed"
}
```

Post-MVP may support:

```json
{
  "scope": "all-running"
}
```

### Output

```json
{
  "id": "run_01J...",
  "status": "cancelled",
  "message": "Cancellation requested."
}
```

## `subagent_steer` post-MVP

Purpose: inject guidance into a running background or mux-backed subagent.

### Input

```json
{
  "id": "run_01J...",
  "message": "Ignore generated files and focus on src/auth only."
}
```

MVP should not implement steering unless the chosen backend supports it reliably.

## Standard result envelope

```json
{
  "id": "run_01J...",
  "parentRunId": null,
  "agent": "reviewer",
  "runtime": "subprocess",
  "contextMode": "summary",
  "status": "completed",
  "startedAt": "2026-06-26T10:00:00.000Z",
  "endedAt": "2026-06-26T10:03:00.000Z",
  "summary": "The change is mostly safe; one concurrency risk remains.",
  "findings": [
    {
      "severity": "high",
      "title": "Concurrent refresh can overwrite a newer token",
      "file": "src/auth/session.ts",
      "line": 184,
      "evidence": "The write path does not compare token version before update.",
      "recommendation": "Use compare-and-swap or version check before writing."
    }
  ],
  "artifacts": [
    {
      "name": "review.json",
      "kind": "json",
      "path": "runs/run_01J/artifacts/review.json"
    }
  ],
  "filesRead": ["src/auth/session.ts"],
  "filesChanged": [],
  "commandsRun": [],
  "testsRun": [],
  "cost": {
    "estimatedUsd": 0.42,
    "inputTokens": 12431,
    "outputTokens": 2210,
    "cacheReadTokens": 0,
    "cacheWriteTokens": 0
  },
  "confidence": 0.82,
  "nextActions": ["Add concurrency regression test"]
}
```

## Error envelope

```json
{
  "id": "run_01J...",
  "agent": "reviewer",
  "runtime": "subprocess",
  "contextMode": "summary",
  "status": "failed",
  "startedAt": "2026-06-26T10:00:00.000Z",
  "endedAt": "2026-06-26T10:30:01.000Z",
  "summary": "Reviewer timed out before producing a valid result.",
  "findings": [],
  "artifacts": [
    {
      "name": "stderr.txt",
      "kind": "text",
      "path": "runs/run_01J/artifacts/stderr.txt"
    }
  ],
  "filesRead": [],
  "filesChanged": [],
  "commandsRun": [],
  "testsRun": [],
  "cost": {
    "estimatedUsd": null
  },
  "confidence": 0,
  "nextActions": [],
  "error": {
    "code": "timeout",
    "message": "Subagent exceeded maxRuntimeSec=1800.",
    "retryable": true,
    "details": {
      "elapsedMs": 1801000
    }
  }
}
```

## Design constraints

- Tool descriptions should be concise, but not so terse that the parent model misuses them.
- Tool inputs must reject unknown properties.
- Tool outputs must include structured `details` suitable for UI and state reconstruction.
- Large logs and transcripts must be artifact references, not parent-context text.
- Compatibility aliases must not bypass canonical validation.
