---
name: pi-harness-routing
description: Use in Pi Coding Agent when deciding how to route repository instructions, skills, context files, /reload, or Pi-specific harness behavior.
---

# Pi harness routing skill

This is a thin adapter. Do not duplicate the repository workflow here.

Read:

1. `AGENTS.md`
2. `.ai-agent/harness/pi-coding-agent.md`
3. `.ai-agent/routing.md` or `.ai-agent/routing-manifest.json` only if routing is not obvious

Then read only the task-specific `.ai-agent/` packs required by root `AGENTS.md`.

Do not bulk-read `.ai-agent/`.
Do not add or change `.pi/settings.json` unless the owner explicitly approves it.
After changing context files, tell the owner that Pi sessions need `/reload` or restart.
