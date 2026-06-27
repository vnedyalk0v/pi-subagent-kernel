---
name: pi-subagent-kernel-open-pr
description: Use when opening or updating a pull request for Pi SubAgent Kernel, including verifier, metadata, and PR body requirements.
---

This is a thin adapter skill for Pi SubAgent Kernel. It is not the canonical source of truth.

First follow root `AGENTS.md`. Then read only these routed instruction files:

- `.ai-agent/workflows/branch-commit-pr.md`
- `.ai-agent/workflows/pre-pr-verifier.md`
- `.ai-agent/templates/pr-body.md`
- `.ai-agent/templates/validation-evidence.md`

Do not bulk-read `.ai-agent/`. Do not bypass owner approval, issue scope, pre-PR verifier, Codex review, safety defaults, no-merge, or no-publish rules.


## Cross-harness note

This is a thin skill adapter for Codex/Pi-style skill discovery. It does not replace root `AGENTS.md`; read only the routed `.ai-agent/` files required for the current task.
