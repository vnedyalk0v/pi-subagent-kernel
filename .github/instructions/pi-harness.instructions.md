---
applyTo: "AGENTS.md,CLAUDE.md,.ai-agent/**,.agents/skills/**,.pi/**"
---

For instruction or Pi-harness files, keep root `AGENTS.md` authoritative. Do not add eager imports that force all `.ai-agent/` files into context. Do not add active `.pi/settings.json` without explicit owner approval. If Pi context files change, mention that Pi sessions require `/reload` or restart.
