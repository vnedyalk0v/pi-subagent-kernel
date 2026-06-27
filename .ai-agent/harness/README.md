# Harness adapters

These files add harness-specific operational rules without duplicating the repository workflow.

Read exactly one adapter when the current execution environment is known and the task could be affected by harness behavior.

- Pi Coding Agent: `.ai-agent/harness/pi-coding-agent.md`
- Codex: `.ai-agent/harness/codex.md`
- Claude Code: `.ai-agent/harness/claude-code.md`
- GitHub Copilot / Copilot coding agent / Copilot review: `.ai-agent/harness/copilot.md`

If the harness is unknown:

1. Do not assume automatic loading, skill support, review triggers, or shell behavior.
2. Follow root `AGENTS.md`.
3. Read the smallest likely adapter only if it changes the task.
4. If a required harness feature is unavailable or unverified, stop and ask the owner.

Adapters are not authority above root `AGENTS.md`.
