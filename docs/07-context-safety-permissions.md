# Context, Safety, and Permissions

## Core safety posture

Default posture:

```yaml
nestedSubagents: false
maxDepth: 1
maxThreads: 4
filesystem: read-only
network: none
mcpServers: []
projectAgentsRequireTrust: true
projectAgentsRequireConfirmation: true
childExtensions: deny-by-default
```

These defaults are intentionally stricter than many convenience packages. The product goal is predictable delegation, not maximum autonomy.

## Context isolation

Subagents are valuable because noisy exploration, logs, test output, and broad file reads can stay outside the main conversation. The parent should receive only the final result envelope plus artifact references.

### Context modes

| Mode | Child receives | Use when | Risk |
|---|---|---|---|
| `none` | Task + agent prompt + environment basics | Small isolated questions | Child may lack project context |
| `summary` | Task + agent prompt + compact parent/project summary | Default for most tasks | Summary can omit details |
| `fork` | Branch/copy of relevant parent context | Task depends on previous discussion | More context/cost; may leak too much |
| `full` | Full parent transcript | Rare debugging or continuity tasks | High context/cost/privacy risk |

`summary` should be default. `full` must require explicit selection and policy approval.

## Parent-to-child payload

Recommended payload:

```json
{
  "task": "Review the auth diff.",
  "agentInstructions": "...",
  "workingDirectory": "/repo",
  "contextMode": "summary",
  "parentSummary": "...",
  "constraints": ["read-only", "return actionable findings"],
  "fileHints": ["src/auth/session.ts"],
  "diffHint": "artifact:current-diff.patch",
  "allowedTools": ["read", "grep", "bash:test-only"],
  "outputSchema": "review_findings_v1"
}
```

Do not pass:

- Full chat history by default.
- Secrets from parent environment unless explicitly allowed.
- Other child transcripts except summarized artifacts.
- Tool outputs that are unrelated to the child task.

## Child-to-parent payload

Recommended payload:

```json
{
  "summary": "...",
  "findings": [],
  "artifacts": [],
  "filesRead": [],
  "filesChanged": [],
  "testsRun": [],
  "confidence": 0.8,
  "nextActions": []
}
```

The parent should not receive raw child thought process. Store operational traces as events or artifacts for debugging, not as conversational content.

## Permission model

### Policy layers

From highest to lowest authority:

1. Hardcoded safety caps.
2. User/global settings.
3. Project settings, if trusted.
4. Spawn-call limits.
5. Agent definition defaults.
6. Backend capability defaults.

Higher layers can reduce permissions; lower layers must not expand beyond higher caps.

### Filesystem policy

```yaml
filesystem: none          # no file access
filesystem: read-only     # read/search/list only
filesystem: workspace-write
filesystem: worktree-write
filesystem: unrestricted  # discouraged; requires explicit user policy
```

Implementation agents should use `worktree-write`, not `workspace-write`, once the worktree backend exists.

### Shell policy

```yaml
shell: none
shell: test-only
shell: ask
shell: allow
```

`test-only` is a convention that must be enforced with a command classifier or allowlist. If reliable enforcement is not implemented, treat `test-only` as `ask`, not as `allow`.

### Network policy

```yaml
network: none
network: docs-only
network: ask
network: allow
```

In MVP, unless Pi exposes enforceable network sandboxing, treat network policy as tool availability plus command approval. Be honest in docs and UI: this is not an OS-level network sandbox.

### MCP policy

- MCP servers must be explicitly allowed per agent or inherited from policy.
- Project-local MCP server definitions require trust.
- Do not auto-start new MCP servers from imported agent files unless policy allows it.
- `mcp:*` style wildcards should be resolved deterministically and shown in diagnostics.

### Nested subagents

Default:

```yaml
nestedSubagents: false
maxDepth: 1
```

Only coordinator-style agents should be allowed to spawn nested agents. Even then:

- Enforce max depth.
- Enforce max total descendants.
- Enforce max concurrent descendants.
- Emit nested run tree in status view.
- Prevent cycles such as `planner -> planner` unless explicit.

## Project trust

Project-local inputs include:

- Agent definitions.
- Project settings.
- Project extension config.
- MCP definitions.
- Skills or prompt templates used by subagents.

Trust rule:

```text
If the current project is not trusted, do not load project-local agent definitions.
```

If the project is trusted but the agent definition is new or changed, post-MVP may ask for confirmation before first use.

## Budget policy

Budget dimensions:

```yaml
maxRuntimeSec: 1800
maxTurns: 12
maxInputTokens: 50000
maxOutputTokens: 8000
maxCostUsd: 1.00
maxThreads: 4
maxDepth: 1
```

When provider usage/cost metadata is unavailable, enforce time/turn/thread limits and mark cost as `unknown` rather than fabricating estimates.

## Threat model

### In scope

- Prompt-driven misuse of tools.
- Accidental recursive fanout.
- Context flooding.
- Child agent crashes.
- Background jobs left running.
- Project-local config surprise.
- Conflicting concurrent edits.

### Out of scope for MVP

- Malicious local code with OS user permissions.
- Hardened kernel/container sandboxing.
- Supply-chain security for all installed npm packages.
- Perfect secret exfiltration prevention when shell/network tools are allowed.

## Required safety tests

- Reviewer cannot call edit/write tools.
- Unknown tool is denied.
- Nested spawn is denied by default.
- `maxDepth` prevents recursive fanout.
- `maxThreads` queues or denies excess concurrency.
- Timeout cancels child.
- Project-local agent is ignored or blocked without trust.
- `inheritContext: full` is denied unless explicitly permitted.
- Worktree backend never edits parent worktree by fallback.
- Subprocess cancellation kills child process.

## User-facing honesty

Use precise wording:

- Good: “This agent is restricted by Pi tool policy and backend controls.”
- Bad: “This is fully sandboxed.”

- Good: “Network access is disabled by not granting network-capable tools; OS-level enforcement depends on backend support.”
- Bad: “Network is impossible.”
