# Claude Code harness adapter

Use this when the current agent is Claude Code or when a task involves `CLAUDE.md` behavior.

Rules:

1. Root `AGENTS.md` remains the canonical repo workflow.
2. `CLAUDE.md` must remain a thin adapter. Do not add broad `@path` imports to every `.ai-agent/` file.
3. Claude `@path` imports are expanded into context at launch. They help organization but do not implement token-saving routing.
4. Mention routed file paths in backticks to avoid accidental eager imports.
5. If Claude-specific memory or import behavior conflicts with root `AGENTS.md`, root `AGENTS.md` wins.
6. If a task requires a detailed workflow, read the routed `.ai-agent/` pack explicitly instead of importing everything through `CLAUDE.md`.
7. Do not store owner-private state or hidden reasoning in Claude memory files.
