# Compatibility Strategy

## Goal

Support useful migration from Codex, Claude Code, OpenCode-style agents, and existing Pi subagent conventions without copying unsafe defaults.

Compatibility is an adapter layer, not the core runtime.

## Codex compatibility

### Source behavior to preserve where safe

Codex custom agents use standalone TOML files with required `name`, `description`, and `developer_instructions`. Optional fields can include model, reasoning effort, sandbox mode, MCP servers, and skills configuration. Codex documents global subagent settings such as max threads, max depth, and job runtime.

### Import mapping

| Codex field | Pi-native field | Notes |
|---|---|---|
| `name` | `name` | Preserve exactly if valid; otherwise normalize with diagnostic. |
| `description` | `description` | Preserve. |
| `developer_instructions` | body | Preserve as Markdown body. |
| `nickname_candidates` | `display.nicknameCandidates` | UI only. |
| `model` | `model` | Validate availability later. |
| `model_reasoning_effort` | `thinking` | Normalize provider-specific values. |
| `sandbox_mode` | `permissions.filesystem` | Do not weaken global policy. |
| `mcp_servers` | `mcpServers` | Require explicit trust and allowlist. |
| `skills.config` | `skills` | Lossy; store original under `compat.codex`. |

### Codex-specific features not in MVP

- CSV batch spawning.
- SQLite-backed job export compatibility.
- Exact Codex thread UI semantics.

### Safety adaptation

Codex child agents may inherit sandbox policy. pi-subagent-kernel should instead compute effective policy from global caps plus imported config. Imported config must not silently increase permission.

## Claude Code compatibility

### Source behavior to preserve where safe

Claude Code subagents are Markdown files with YAML frontmatter. `name` and `description` are required; the body is the agent prompt. Claude supports tool allowlists/denylists, model selection, MCP servers, hooks, foreground/background behavior, and automatic or explicit invocation.

### Import mapping

| Claude field | Pi-native field | Notes |
|---|---|---|
| `name` | `name` | Preserve if valid. |
| `description` | `description` | Preserve. |
| body | body | Preserve. |
| `tools` | `tools` | Map names through tool alias table. |
| `disallowedTools` | `disallowedTools` | Apply after allowlist per policy. |
| `model` | `model` | Provider-specific resolution required. |
| `mcpServers` | `mcpServers` | Require trust/allowlist. |
| `skills` | `skills` | Preserve as requested skills. |
| `isolation: worktree` | `runtime: worktree` | Only if worktree backend available. |
| hooks | `compat.claude.hooks` | Do not execute in MVP unless explicitly implemented. |

### Tool alias mapping examples

| Claude | Pi candidate |
|---|---|
| `Read` | `read` |
| `Grep` | `grep` |
| `Glob` | `find` or Pi-specific glob/search tool if available |
| `Bash` | `bash` |
| `Edit` | `edit` |
| `Write` | `write` |
| `Agent` / `Task` | `subagent_spawn` compatibility alias |

Verify actual Pi tool names from the installed version before finalizing aliases.

### Behavior not copied by default

- Automatic delegation based only on description.
- Inheriting all tools when `tools` is omitted.
- Executing Claude-specific hooks.
- Letting project-local agent definitions bypass Pi trust.

## OpenCode-style compatibility

Pi package ecosystem includes OpenCode-compatible agent definitions and permission policy packages. Support should be pragmatic:

- Import `.agent.md` frontmatter if format is simple Markdown/YAML.
- Preserve permission blocks under `permissions` when recognizable.
- Emit diagnostics for unsupported rules.
- Use deny-by-default if a rule cannot be mapped.

## Existing Pi package compatibility

The Pi ecosystem already uses multiple names:

```text
subagent
Agent
Task
get_subagent_result
steer_subagent
AgentStatus
StopAgent
```

Recommendation:

- Canonical tools stay `subagent_*`.
- Compatibility aliases are optional and disabled by default until tested.
- Alias inputs normalize into canonical `SpawnRequest`.
- Alias outputs still use the standard envelope.

## Compatibility diagnostics

Every imported agent should expose:

```json
{
  "source": "claude|codex|opencode|pi",
  "sourcePath": "...",
  "lossy": true,
  "warnings": [
    "Claude hooks are preserved as metadata but not executed.",
    "Omitted tools were treated as empty allowlist by project policy."
  ]
}
```

## Migration priority

1. Pi-native Markdown/YAML.
2. Claude Markdown/YAML.
3. Codex TOML.
4. OpenCode-style Markdown/YAML.
5. Third-party Pi package-specific schemas only if users request them.

## Compatibility test fixtures

Create fixtures for:

- Basic Claude code-reviewer agent.
- Claude agent with tools allowlist.
- Claude agent with disallowedTools.
- Codex reviewer TOML.
- Codex explorer TOML with read-only sandbox.
- OpenCode permission block.
- Invalid unsupported fields.

## Principle

Compatibility should make migration easier, not import unsafe behavior.
