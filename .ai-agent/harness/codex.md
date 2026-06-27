# Codex harness adapter

Use this when the current agent is Codex CLI/cloud or when a task involves Codex GitHub review, Codex skills, or Codex project-instruction behavior.

Rules:

1. Codex reads `AGENTS.md` before work; keep root `AGENTS.md` focused on always-on repo rules.
2. Do not rely on arbitrary `.ai-agent/` files loading automatically. Root `AGENTS.md` must route the agent to them.
3. Codex project-doc loading is byte-limited. Do not make root `AGENTS.md` a full workflow manual.
4. Codex skills use progressive disclosure. Shared `.agents/skills/*/SKILL.md` files should be thin adapters that route to `.ai-agent/` packs.
5. Do not create `AGENTS.override.md` in the repo. If a local override exists and affects behavior, disclose it in the plan.
6. Codex GitHub review is still advisory. Validate every `codex-connector bot` finding before acting.
7. Do not post `@codex review` unless root `AGENTS.md` and the review loop allow it.

This adapter does not replace `.ai-agent/workflows/codex-review-loop.md`.
