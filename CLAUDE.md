# Claude Code Instructions

Read `AGENTS.md` first. It is the source of truth for repository-level engineering rules.

Project identity: **Pi SubAgent Kernel** (`pi-subagent-kernel`).

Claude-specific reminders:

- Use subagents only when the task is independent enough to justify context isolation.
- Keep implementation work in small, reviewable increments.
- Do not rely on Claude-only behavior when implementing Pi functionality. The package must work as a Pi extension, not as a Claude plugin.
- When translating Claude subagent concepts, implement them as Pi-native tools, commands, schemas, event handling, and backends.
- Do not assume a `.claude/agents` file is trusted just because it exists. Imported project-local definitions must follow this project's trust and permission policy.
