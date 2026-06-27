---
name: pi-subagent-kernel-handle-codex-review
description: Use when handling codex-connector bot comments, review threads, stale +1 results, or automated AI review gates.
---

This is a thin adapter skill for Pi SubAgent Kernel. It is not the canonical source of truth.

First follow root `AGENTS.md`. Then read only these routed instruction files:

- `.ai-agent/workflows/codex-review-loop.md`
- `.ai-agent/review/codex-severity-taxonomy.md`
- `.ai-agent/templates/codex-review-replies.md`

Do not bulk-read `.ai-agent/`. Do not bypass owner approval, issue scope, pre-PR verifier, Codex review, safety defaults, no-merge, or no-publish rules.


## Cross-harness note

This is a thin skill adapter for Codex/Pi-style skill discovery. It does not replace root `AGENTS.md`; read only the routed `.ai-agent/` files required for the current task.
