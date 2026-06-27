---
name: pi-subagent-kernel-ci-triage
description: Use when CI fails on a pull request or after a push and the agent must diagnose and fix the smallest in-scope cause.
---

This is a thin adapter skill for Pi SubAgent Kernel. It is not the canonical source of truth.

First follow root `AGENTS.md`. Then read only these routed instruction files:

- `.ai-agent/workflows/ci-failure-triage.md`
- `.ai-agent/implementation/testing-and-validation.md`
- `.ai-agent/templates/ci-failure-report.md`

Do not bulk-read `.ai-agent/`. Do not bypass owner approval, issue scope, pre-PR verifier, Codex review, safety defaults, no-merge, or no-publish rules.


## Cross-harness note

This is a thin skill adapter for Codex/Pi-style skill discovery. It does not replace root `AGENTS.md`; read only the routed `.ai-agent/` files required for the current task.
