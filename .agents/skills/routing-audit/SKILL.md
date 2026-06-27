---
name: pi-subagent-kernel-routing-audit
description: Use when auditing or changing AGENTS.md, .ai-agent routing, Copilot instructions, Claude adapter, or skill adapters.
---

This is a thin adapter skill for Pi SubAgent Kernel. It is not the canonical source of truth.

First follow root `AGENTS.md`. Then read only these routed instruction files:

- `.ai-agent/workflows/instruction-change-governance.md`
- `.ai-agent/tests/routing-audit.md`
- `.ai-agent/tests/expected-routing.md`

Do not bulk-read `.ai-agent/`. Do not bypass owner approval, issue scope, pre-PR verifier, Codex review, safety defaults, no-merge, or no-publish rules.


## Cross-harness note

This is a thin skill adapter for Codex/Pi-style skill discovery. It does not replace root `AGENTS.md`; read only the routed `.ai-agent/` files required for the current task.


Also include Pi harness scenarios from `.ai-agent/tests/routing-audit.md` when the bundle will be used by Pi Coding Agent.
