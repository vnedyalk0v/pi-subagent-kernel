# Agent Definition Specification

## Format

Pi-native agent definitions should be Markdown files with YAML frontmatter:

```md
---
name: reviewer
description: Reviews diffs for correctness, security, regressions, and missing tests.
runtime: subprocess
model: inherit
thinking: medium
tools:
  - read
  - grep
  - bash:test-only
permissions:
  filesystem: read-only
  network: none
  mcp: []
context:
  inherit: summary
limits:
  maxTurns: 12
  maxRuntimeSec: 1800
  maxCostUsd: 1.00
  maxDepth: 1
outputSchema: review_findings_v1
---
You are a strict reviewer. Return only actionable findings with evidence.
```

The body after frontmatter is the agent's system/developer instruction.

## Required fields

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `name` | string | yes | Lowercase kebab-case or snake_case recommended. Must be unique after normalization. |
| `description` | string | yes | Used by parent agent and UI to decide when this agent is appropriate. |
| body | Markdown string | yes | The agent prompt/instructions. |

## Recommended optional fields

| Field | Type | Purpose |
|---|---:|---|
| `runtime` | enum | `sdk`, `subprocess`, `worktree`, `mux`, `remote`, or `auto`. |
| `model` | string | `inherit`, concrete provider/model ID, or route key. |
| `thinking` | enum/string | Provider-specific effort level; normalize internally. |
| `tools` | string[] | Tool allowlist. Empty means no tools; omitted means policy default, not all tools. |
| `disallowedTools` | string[] | Optional denylist applied after allowlist resolution. |
| `skills` | string[] | Skills to preload or allow, depending on Pi API support. |
| `mcpServers` | list/map | MCP servers explicitly allowed for this agent. |
| `permissions` | object | Filesystem, network, shell, write, MCP, and spawn policies. |
| `context` | object | Context inheritance and included files/globs. |
| `limits` | object | Runtime, cost, depth, turns, tokens, concurrency. |
| `outputSchema` | string/object | Named or inline schema for result validation. |
| `resultMode` | enum | `summary`, `json`, `patch`, `artifact`, or `mixed`. |
| `tags` | string[] | Discovery, UI grouping, or compatibility metadata. |

## Naming rules

MVP name validation:

```text
^[a-z][a-z0-9_-]{1,63}$
```

Normalize names case-insensitively for lookup. Preserve original name for display.

Reject names that collide with canonical tool names unless explicitly allowed by config.

## Discovery locations

Recommended normalized discovery order, highest priority first:

1. Explicit agent definitions passed by the current command/tool call.
2. Trusted project-local Pi definitions: `<project-config-dir>/agents/*.md`.
3. User/global Pi definitions: `<user-config-dir>/agents/*.md`.
4. Imported Claude project definitions: `.claude/agents/*.md`, if compatibility import is enabled.
5. Imported Claude user definitions: `~/.claude/agents/*.md`, if compatibility import is enabled.
6. Imported Codex project definitions: `.codex/agents/*.toml`, if compatibility import is enabled.
7. Imported Codex user definitions: `~/.codex/agents/*.toml`, if compatibility import is enabled.
8. Built-in definitions.

Do not hardcode `.pi` for Pi project config discovery when the current Pi API exposes a config directory constant or helper.

## Trust rules

- User/global definitions are trusted according to the user's local config trust model.
- Project-local definitions require project trust.
- Imported project-local Claude/Codex/OpenCode definitions are still project-local inputs and require trust.
- Agent files must not auto-install dependencies, MCP servers, or packages.
- Agent files must not override global safety caps unless policy allows it.

## Permission semantics

Use allowlists rather than broad inheritance.

Recommended default if `tools` is omitted:

```yaml
tools: []
```

Then built-in agents explicitly request the tools they need. This is stricter than some upstream systems that inherit all tools when omitted, but it is safer for a Pi package whose goal is predictable execution.

If compatibility mode imports a Claude definition where omitted tools means inherited tools, mark the imported agent with:

```yaml
compat:
  source: claude
  inheritedTools: true
```

Then resolve according to the project policy, not blindly.

## Context config

```yaml
context:
  inherit: summary        # none | summary | fork | full
  includeFiles:
    - src/auth/**/*.ts
  excludeFiles:
    - '**/node_modules/**'
  parentSummaryMaxTokens: 1200
  attachRecentDiff: true
```

`full` must require explicit spawn-time opt-in or trusted project policy. It should not be selected only by an agent file.

## Limits config

```yaml
limits:
  maxTurns: 12
  maxRuntimeSec: 1800
  maxInputTokens: 50000
  maxOutputTokens: 8000
  maxCostUsd: 1.00
  maxDepth: 1
```

Global caps must override agent-local higher values.

## Output schema references

MVP named schemas:

```text
summary_v1
review_findings_v1
implementation_patch_v1
test_report_v1
research_notes_v1
```

An agent may request a schema, but the kernel must validate and normalize the result. If the child returns invalid JSON, the reducer should preserve raw output as an artifact and return a structured validation error.

## Example: read-only scout

```md
---
name: scout
description: Read-only codebase explorer for finding files, symbols, dependencies, and execution paths.
runtime: sdk
tools: [read, grep, find, ls]
permissions:
  filesystem: read-only
  network: none
context:
  inherit: summary
limits:
  maxRuntimeSec: 900
  maxCostUsd: 0.25
outputSchema: research_notes_v1
---
You explore code. Do not edit files. Prefer targeted search and concise evidence.
```

## Example: worktree implementer

```md
---
name: implementer
description: Makes small, scoped code changes after planning and evidence are available.
runtime: worktree
tools: [read, grep, find, ls, bash, edit, write]
permissions:
  filesystem: workspace-write
  network: ask
  shell: ask
context:
  inherit: summary
limits:
  maxRuntimeSec: 3600
  maxCostUsd: 2.50
outputSchema: implementation_patch_v1
---
Implement the smallest safe change. Keep unrelated files untouched. Run focused validation.
```

## Compatibility notes

Claude Markdown/YAML files map naturally to this format. Codex TOML files require conversion:

| Codex TOML | Pi-native field |
|---|---|
| `name` | `name` |
| `description` | `description` |
| `developer_instructions` | body |
| `model` | `model` |
| `model_reasoning_effort` | `thinking` |
| `sandbox_mode` | `permissions.filesystem` or `sandbox` |
| `mcp_servers` | `mcpServers` |
| `skills.config` | `skills` with compatibility metadata |

Lossy fields must be recorded under `compat.unmapped` rather than silently ignored.
