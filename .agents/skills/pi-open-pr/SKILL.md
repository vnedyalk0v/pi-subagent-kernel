---
name: pi-open-pr
description: Use in Pi Coding Agent before opening a PR to enforce validation, ponytail-review, metadata, and review-loop prerequisites.
---

# Pi open PR skill

Read:

1. `AGENTS.md`
2. `.ai-agent/harness/pi-coding-agent.md`
3. `.ai-agent/workflows/branch-commit-pr.md`
4. `.ai-agent/workflows/pre-pr-verifier.md`
5. `.ai-agent/templates/pr-body.md`
6. `.ai-agent/templates/validation-evidence.md`

Hard gates:

- Never open a PR before local validation is run or documented unavailable.
- Never open a PR before `ponytail-review` passes, unless the owner approved a documented fallback.
- Assign the issue and PR to `vnedyalk0v`.
- Use `Closes #<issue>` only when merge should close the issue.
- After PR open, follow the `codex-connector bot` review loop.
