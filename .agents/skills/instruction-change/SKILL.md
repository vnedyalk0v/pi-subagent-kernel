---
name: pi-subagent-kernel-instruction-change
description: Use when editing AGENTS.md, CLAUDE.md, .github/copilot-instructions.md, .github/instructions, .agents/skills, or .ai-agent files.
---

This is a thin adapter skill for Pi SubAgent Kernel. It is not the canonical source of truth.

First follow root `AGENTS.md`. Then read only these routed instruction files:

- `.ai-agent/workflows/instruction-change-governance.md`
- `.ai-agent/templates/instruction-change-report.md`
- `.ai-agent/tests/routing-audit.md`

Do not bulk-read `.ai-agent/`. Do not bypass owner approval, issue scope, pre-PR verifier, Codex review, safety defaults, no-merge, or no-publish rules.


## Cross-harness note

This is a thin skill adapter for Codex/Pi-style skill discovery. It does not replace root `AGENTS.md`; read only the routed `.ai-agent/` files required for the current task.
