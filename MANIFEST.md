# Pi SubAgent Kernel AI-agent instruction bundle — v3

This bundle provides strict, modular instructions for AI coding agents working in `vnedyalk0v/pi-subagent-kernel`.

V3 expands v2 to support **Pi Coding Agent / Pi harness** explicitly while preserving Codex, Claude Code, and GitHub Copilot compatibility.

## Design goals

1. Keep root `AGENTS.md` as a small always-on router.
2. Preserve strict workflow gates: issue order, owner assignment, branch/PR conventions, pre-PR verifier, automated Codex review loop, no merge, no publish.
3. Use routed `.ai-agent/` files for detailed task instructions.
4. Use thin skill/adaptor files for harness-specific surfaces.
5. Avoid eager imports that defeat token savings.
6. Treat untrusted input, dependencies, releases, repository controls, and instruction changes as high-risk.
7. Add Pi-specific handling for context files, skills, `/reload`, project trust, default tools, extensions, RPC/steering, and compaction.

## Important files

- `AGENTS.md` — canonical always-on router.
- `CLAUDE.md` — thin Claude Code adapter.
- `.ai-agent/harness/pi-coding-agent.md` — Pi-specific adapter.
- `.ai-agent/harness/codex.md` — Codex-specific adapter.
- `.ai-agent/harness/claude-code.md` — Claude Code-specific adapter.
- `.ai-agent/harness/copilot.md` — Copilot-specific adapter.
- `.ai-agent/routing-manifest.json` — structured routing source.
- `.ai-agent/tests/routing-audit.md` — read-only routing audit prompt.
- `.ai-agent/tests/expected-routing.md` — golden expected routing.
- `.agents/skills/*/SKILL.md` — thin on-demand skill adapters, discoverable by Pi and Codex-style skill loaders.
- `.pi/settings.example.json` — example only; not active settings.

## Pi-specific notes

Pi supports `AGENTS.md`/`CLAUDE.md` context files, project/global skills, and `.agents/skills/` discovery after project trust. This bundle intentionally keeps `.agents/skills` as the shared skill location and does not add active `.pi/settings.json`.

After changing context/instruction files, Pi sessions should run `/reload` or restart before expecting changes to apply.

## Installation expectation

Copy these files into the repository root in a dedicated PR. Then run the routing audit before using the bundle for implementation work.
