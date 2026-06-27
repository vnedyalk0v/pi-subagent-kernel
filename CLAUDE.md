# CLAUDE.md — Claude Code adapter

Follow root `AGENTS.md` as the canonical workflow for this repository.

Do not use broad `@path` imports here. Claude expands imports into context at startup, which defeats the token-saving purpose of the `.ai-agent/` router.

When running in Claude Code:

1. Read `AGENTS.md`.
2. Read `.ai-agent/harness/claude-code.md` only when Claude-specific memory/import behavior matters.
3. Read only the routed `.ai-agent/` packs required by `AGENTS.md` for the current task.
4. Do not bulk-read `.ai-agent/`.
5. Do not store hidden reasoning, owner-private state, or workflow decisions in memory files.
