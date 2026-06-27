---
name: pi-codex-review
description: Use in Pi Coding Agent when handling codex-connector bot feedback on a pull request.
---

# Pi Codex review handling skill

Read:

1. `AGENTS.md`
2. `.ai-agent/harness/pi-coding-agent.md` if shell/GitHub command behavior matters
3. `.ai-agent/workflows/codex-review-loop.md`
4. `.ai-agent/review/codex-severity-taxonomy.md`
5. `.ai-agent/templates/codex-review-replies.md`

Rules:

- Validate every bot finding.
- Fix valid in-scope findings with the smallest safe change.
- Reply to every thread with evidence.
- Resolve threads only after addressing or explaining them.
- Wait for a current-head `+1` result before owner review readiness.
- Do not spam `@codex review` if automatic review is configured or in progress.
