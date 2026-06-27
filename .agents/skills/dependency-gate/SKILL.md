---
name: pi-subagent-kernel-dependency-gate
description: Use when adding, removing, upgrading, or reviewing dependencies, lockfiles, package metadata, or third-party tooling.
---

This is a thin adapter skill for Pi SubAgent Kernel. It is not the canonical source of truth.

First follow root `AGENTS.md`. Then read only these routed instruction files:

- `.ai-agent/security/dependency-gate.md`
- `.ai-agent/templates/dependency-gate-report.md`

Do not bulk-read `.ai-agent/`. Do not bypass owner approval, issue scope, pre-PR verifier, Codex review, safety defaults, no-merge, or no-publish rules.


## Cross-harness note

This is a thin skill adapter for Codex/Pi-style skill discovery. It does not replace root `AGENTS.md`; read only the routed `.ai-agent/` files required for the current task.
