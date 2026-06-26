# Source Basis and Claims Policy

Prepared on **2026-06-26**.

This document records which facts are source-backed and which ideas are design recommendations. Use it to avoid false positives when implementing the project.

## Claim levels

| Level | Meaning | How to use it |
|---|---|---|
| Verified official fact | Confirmed in official Pi, OpenAI/Codex, or Claude documentation. | May be used as a requirement or compatibility constraint. |
| Package README claim | Stated on a Pi package page or package README. | Use as ecosystem evidence, not as proof the implementation is correct or secure. |
| Design recommendation | Proposed by this documentation pack. | Implement only when accepted by the project roadmap. |
| Assumption | Reasonable but not yet verified. | Must be validated before coding against it. |

## Verified official facts

| Fact | Source |
|---|---|
| Pi is intentionally minimal and customizable through extensions, skills, prompt templates, themes, and packages. Pi's public site states that Pi skips built-in subagents and plan mode, and users can build or install those features. | https://pi.dev/ |
| Pi extensions are TypeScript modules that can subscribe to lifecycle events, register LLM-callable custom tools, add commands, and add UI interactions. | https://pi.dev/docs/latest/extensions |
| Pi extension docs describe `pi.registerTool()`, `pi.registerCommand()`, lifecycle events, tool events, project trust events, `ctx.signal`, active-tool management, and warnings about long-lived resources. | https://pi.dev/docs/latest/extensions |
| Pi package catalog says extensions, skills, prompt templates, and themes are published to npm and installed with `pi install npm:<package>`. | https://pi.dev/packages |
| Pi package pages display a security note that packages can execute code and influence agent behavior; source should be reviewed before installation. | Pi package pages, for example https://pi.dev/packages/%40tintinweb/pi-subagents and https://pi.dev/packages/%40narumitw/pi-subagents |
| Pi release notes state that `CONFIG_DIR_NAME` was exported so extensions can resolve project config paths without hardcoding `.pi`. | https://pi.dev/news |
| Codex subagents can spawn specialized agents in parallel and collect results in one response. Codex custom agents can have different model configuration and instructions. | https://developers.openai.com/codex/subagents |
| Codex built-in agents include `default`, `worker`, and `explorer`. Codex custom agents are TOML files under user/project agent directories and require `name`, `description`, and `developer_instructions`. | https://developers.openai.com/codex/subagents |
| Codex global subagent settings include `agents.max_threads`, `agents.max_depth`, and `agents.job_max_runtime_seconds`. The documented defaults include `max_threads = 6` and `max_depth = 1`. | https://developers.openai.com/codex/subagents |
| Claude Code subagents are Markdown files with YAML frontmatter. Claude requires `name` and `description`, and the body is the subagent system prompt. | https://code.claude.com/docs/en/sub-agents |
| Claude Code describes subagents as separate context windows with custom system prompts, specific tool access, and independent permissions. | https://code.claude.com/docs/en/sub-agents |
| Claude Agent SDK describes subagents as separate agent instances that isolate context, run analyses in parallel, and apply specialized instructions without adding to the main agent prompt. | https://code.claude.com/docs/en/agent-sdk/subagents |
| Claude Agent SDK permissions docs describe permission modes, hooks, declarative allow/deny rules, and a runtime `canUseTool` callback. | https://code.claude.com/docs/en/agent-sdk/permissions |

## Pi package ecosystem evidence

These are package-page claims. They are useful for feature discovery, but they are not independent audits.

| Package or family | Relevant package-page claim | Source |
|---|---|---|
| `pi-subagents` | Parent Pi session starts focused child Pi sessions; foreground/background runs; status inspection; orchestration guidance. | https://pi.dev/packages/pi-subagents |
| `@tintinweb/pi-subagents` | Claude Code-style autonomous subagents with isolated sessions, custom tools/system prompt/model/thinking, foreground/background runs, steering, resume, custom agent types, and FleetView-style UI. | https://pi.dev/packages/%40tintinweb/pi-subagents |
| `@gotgenes/pi-subagents` | In-process subagent core with typed API, foreground/background runs, widget UI, token/context signals, lifecycle events. | https://pi.dev/packages/%40gotgenes/pi-subagents |
| `@narumitw/pi-subagents` | Native Pi extension with isolated `pi --mode json -p --no-session` subprocess workers, single/parallel/fan-in/chain modes, custom agents, confirmation for project agents, and tool allowlists. | https://pi.dev/packages/%40narumitw/pi-subagents |
| `pi-subagents-lite` | Schema-first subagent tooling with foreground/background agents, cost tracking, steering, concurrency, YAML/Markdown agent files, and worktree path support. | https://pi.dev/packages/pi-subagents-lite |
| `@quintinshaw/pi-dynamic-workflows` | Dynamic workflows with model routing, token/cost accounting, journaled resume, git-worktree isolation, interactive `/workflows` TUI, and deep research. | https://pi.dev/packages/%40quintinshaw/pi-dynamic-workflows |
| `pi-dynamic-workflows-oc-style` | OpenCode-style context governance where main-agent-only rules do not leak into subagents by default. | https://pi.dev/packages/pi-dynamic-workflows-oc-style |
| `pi-open-agents` | Unified primary-agent and subagent management with OpenCode-compatible agent definitions. | https://pi.dev/packages/pi-open-agents |
| `@mjakl/pi-subagent` | Markdown/YAML subagents with spawn/fork context modes and project/user agent discovery. | https://pi.dev/packages/%40mjakl/pi-subagent |
| `pi-fast-subagent` | In-process subagents with single, parallel, and background modes, slash commands for background status/cancel, model override, and max nesting guard. | https://pi.dev/packages/pi-fast-subagent?page=29 |
| `@pi-orca/agents` | Lifecycle management across SDK, out-of-process RPC, and tmux modes with worktree allocation. | https://pi.dev/packages/%40pi-orca/agents?page=55 |
| `pi-permission-system` | OpenCode-style agent permission policies can be ported into Pi with minimal friction. | https://pi.dev/packages/pi-permission-system |
| `@odradekk/vera-subagents` | In-process SDK sessions, foreground/background runs, status/cancel/inspect tools, and YAML-defined agents with tool/skill controls. | https://pi.dev/packages/%40odradekk/vera-subagents |
| `pi-submarine` | Narrow foreground child Pi sessions, append-only activity log, depth limit, parallel via native multi-tool calling, and resumable child sessions. | https://pi.dev/packages/pi-submarine |

## Design recommendations in this pack

The following are recommendations, not external facts:

- Use a small kernel with pluggable execution backends.
- Use Markdown/YAML as the Pi-native agent definition format.
- Import Claude Markdown/YAML and Codex TOML definitions into one normalized schema.
- Default `maxDepth` to `1` and `maxThreads` to `4` for the MVP, even though Codex documents a default `maxThreads` of `6`.
- Prefer `inheritContext: summary` for children, not full parent transcript inheritance.
- Provide a standard result envelope for all backends.
- Implement worktree isolation before allowing implementation agents to edit the main repository.
- Keep remote/cloud workers out of MVP.

## Claims not made

This documentation pack does **not** claim:

- That any third-party Pi package is secure.
- That any package-page feature is fully implemented or bug-free.
- That Pi's internal SDK APIs are stable beyond the current docs and typings.
- That Claude, Codex, OpenCode, and Pi agent schemas can be perfectly losslessly converted.
- That automatic subagent delegation is safer than explicit delegation.

## Source maintenance rule

When implementation starts, inspect the installed versions of:

```text
@earendil-works/pi-coding-agent
@earendil-works/pi-agent-core
@earendil-works/pi-ai
```

Then update this document with exact version numbers and any API differences discovered locally.
