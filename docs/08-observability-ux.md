# Observability and UX

## UX goal

Make subagents visible enough to trust, but quiet enough not to pollute the main conversation.

The user should always be able to answer:

- What agents are running?
- What are they doing?
- What did they cost?
- What tools did they use?
- Can I cancel them?
- Where is the final result?
- Did any agent edit files?

## Commands

MVP commands:

```text
/agents
/agents status
/agents inspect <run-id>
/agents cancel <run-id>
/agents config
```

Post-MVP commands:

```text
/agents steer <run-id>
/agents attach <run-id>
/agents artifacts <run-id>
/agents replay <run-id>
/agents costs
/agents doctor
/agents import
```

## Status view

Minimal status output:

```text
Agents
  running: 2   queued: 1   completed: 5   failed: 0

  run_01JABC  scout     sdk         running    14s   Searching src/auth
  run_01JABD  reviewer  subprocess  queued      --   Waiting for slot
  run_01JABE  tester    subprocess  completed   2m   1 failing test found
```

For each run show:

- Run ID.
- Agent name.
- Runtime backend.
- Status.
- Elapsed time.
- Short activity summary.
- Usage/cost when known.
- Whether files changed.

## Inspect view

Inspect should show:

```text
Run: run_01JABC
Agent: reviewer
Runtime: subprocess
Status: completed
Started: ...
Ended: ...
Context mode: summary
Tools: read, grep, bash:test-only
Files read: 12
Files changed: 0
Cost: unknown or $0.42

Summary:
  ...

Findings:
  [high] src/auth/session.ts:184 Concurrent refresh can overwrite newer token

Artifacts:
  review.json
  stderr.txt
  events.jsonl
```

## Event stream

Events should be structured JSONL internally:

```json
{"type":"run.started","runId":"run_01J...","agent":"scout","runtime":"sdk","ts":"2026-06-26T10:00:00.000Z"}
{"type":"run.progress","runId":"run_01J...","message":"Searching src/auth","ts":"2026-06-26T10:00:02.000Z"}
{"type":"run.completed","runId":"run_01J...","status":"completed","ts":"2026-06-26T10:00:20.000Z"}
```

Event design rules:

- No secrets.
- No hidden chain-of-thought.
- No full file contents unless explicitly artifacted and safe.
- Use stable event names.
- Include `runId` on every run event.

## UI rendering

MVP can use command output plus tool details. A richer TUI can come later.

Post-MVP UI ideas:

- Persistent compact widget.
- Expandable run cards.
- Fleet list of parent + child agents.
- Fullscreen run inspector.
- Artifact viewer.
- Cost/token summary.
- Keyboard cancel action.

## Parent conversation output

Foreground run should show concise progress:

```text
Starting reviewer subagent…
Reviewer completed: 2 findings, 0 files changed, 0 tests run.
```

Then return structured details.

Background run should not stream excessive progress into the conversation. It should return:

```text
Started reviewer in background as run_01JABC. Use /agents or subagent_result to inspect.
```

Completion notification may be concise:

```text
Reviewer run_01JABC completed: 2 findings.
```

## Artifacts

Artifacts should be referenced by name, kind, and path/URI:

```json
{
  "name": "current-diff.patch",
  "kind": "patch",
  "path": "runs/run_01J/artifacts/current-diff.patch",
  "bytes": 18291,
  "sha256": "..."
}
```

Artifact kinds:

```text
text
json
markdown
patch
log
transcript-summary
html
image-reference
```

Do not inline large artifacts in parent responses.

## Diagnostics

`/agents doctor` should eventually check:

- Package version.
- Pi version and detected config directories.
- Active tools.
- Built-in agents loaded.
- User agents loaded.
- Project agents blocked or loaded.
- Duplicate agent names.
- Backend availability.
- Worktree support.
- Permission system status.
- Recent failed runs.

## Metrics

Track locally where possible:

- Spawn latency.
- Runtime duration.
- Tokens and cost when available.
- Tool count.
- Files read/changed.
- Retry count.
- Cancellation count.
- Failure code.

Do not send telemetry without explicit user opt-in.

## Accessibility and noise control

- Provide text-first output; do not require rich TUI for basic operation.
- Allow compact and verbose status modes.
- Provide stable run IDs that users can copy.
- Avoid animated-only status indicators.
- Do not require color for meaning.
