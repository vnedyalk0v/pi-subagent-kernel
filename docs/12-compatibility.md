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

Implemented API: `loadClaudeAgentDefinitions(rootDir, { trusted: true })` imports project-local `.claude/agents/**/*.md` files, and `parseClaudeAgentMarkdown(source, file)` imports one Markdown definition. Project-local Claude files require explicit trust just like project-local Pi definitions.

| Claude field | Pi-native field | Notes |
|---|---|---|
| `name` | `name` | Preserve if valid. |
| `description` | `description` | Preserve. |
| body | `instructions` | Preserve as the agent instructions body. |
| `tools` | `tools` | Map names through the implemented tool alias table; omitted tools become an empty allowlist with a warning rather than inheriting all tools. |
| `disallowedTools` | `disallowedTools` | Applied to remove matching entries from the imported `tools` allowlist, then preserved as a denylist. |
| `model` | `model` | Preserved as a requested model string; provider-specific resolution is not performed by the importer. |
| `maxTurns` | `maxTurns` | Preserved as a runtime limit. |
| `mcpServers` | `mcpServers` | Imported as requested server names; inline server configs are preserved under `compat.claude.mcpServers`, but spawn still requires explicit MCP allowlist policy. |
| `skills` | `skills` | Preserve as requested skills. |
| `isolation: worktree` | `compat.claude.unsupported.isolation` | Preserved with a warning; no worktree runtime behavior is enabled by the importer. |
| hooks | `compat.claude.unsupported.hooks` | Preserved with a warning; never executed by the importer. |
| other Claude-only fields | `compat.claude.unsupported` | Preserved with warnings, not silently ignored. |

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

Current importer aliases are intentionally narrow: `Read`→`read`, `Grep`→`grep`, `Glob`→`find` with a warning, `LS`→`ls`, `Bash`→`bash`, `Edit`/`MultiEdit`→`edit`, `Write`→`write`, and `Agent`/`Task`→`subagent_spawn`. Scoped tool strings such as `Agent(worker, researcher)` are split on top-level commas only, mapped by base tool name, and preserved under `compat.claude.scopedTools`. These aliases only normalize definitions; the spawn safety policy can still deny shell, write, MCP, or nested-subagent tools.

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

Every imported agent should expose compatibility metadata. The Claude importer currently stores this under `AgentDefinition.compat` and also returns structured warning objects from the importer result:

```json
{
  "source": "claude",
  "sourcePath": "...",
  "lossy": true,
  "warnings": [
    "hooks: Unsupported Claude field \"hooks\" was preserved under compat.claude.unsupported and is not executed.",
    "tools: Claude omitted tools; Pi import uses an empty allowlist instead of inheriting all tools."
  ],
  "claude": {
    "inheritedTools": true,
    "unsupported": {
      "hooks": {}
    }
  }
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
