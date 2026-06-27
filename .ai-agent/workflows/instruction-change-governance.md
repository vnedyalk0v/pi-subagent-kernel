# Instruction-change governance

Use this file when changing any agent instruction file:

- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.github/instructions/**/*.instructions.md`
- `.agents/skills/**/SKILL.md`
- `.ai-agent/**`

## Goal

Instruction changes must make the workflow clearer, stricter, safer, or more token-efficient without removing important guardrails.

## Required process

1. Read root `AGENTS.md`.
2. Read `.ai-agent/routing-manifest.json`.
3. Read only the instruction files being changed plus direct dependencies.
4. Identify every hard rule being added, changed, moved, or removed.
5. Preserve all safety, assignment, PR, verifier, Codex review, no-merge, no-publish, no-secret, and milestone-order rules.
6. Run the routing audit prompt in `.ai-agent/tests/routing-audit.md` or document why the owner approved skipping it.
7. Compare against `.ai-agent/tests/expected-routing.md`.
8. Update `MANIFEST.md` and `SHA256SUMS.txt` if those files exist and the packaging task requires it.
9. Use `.ai-agent/templates/instruction-change-report.md` in the PR body.

## Forbidden changes without explicit owner approval

- Removing `ponytail-review` as a hard gate.
- Removing Codex review loop requirement.
- Allowing merges by AI agents.
- Allowing npm publish without owner approval.
- Making safety defaults permissive.
- Letting agents bulk-read `.ai-agent/` by default.
- Making `.ai-agent/` files eager imports via `@path` from `CLAUDE.md` or `AGENTS.md`.
- Removing assignment to `vnedyalk0v`.
- Removing issue/PR/project traceability.

## Quality checks

An instruction-change PR must answer:

1. Which files changed?
2. Which hard rules were moved?
3. Which hard rules were added?
4. Which hard rules were removed, if any?
5. Why does this not make the workflow looser?
6. Which routing scenarios were tested?
7. Which files should agents read less often after this change?
8. Which files should agents read more often after this change?

## Stop conditions

Stop and ask the owner if:

- A rule becomes ambiguous.
- A gate becomes optional.
- Two instruction files conflict.
- The routing audit fails.
- You cannot determine whether a removed rule is still preserved elsewhere.


## Pi harness compatibility

When changing `AGENTS.md`, `CLAUDE.md`, `.ai-agent/**`, `.agents/skills/**`, `.github/**`, or `.pi/**`:

1. Read `.ai-agent/harness/pi-coding-agent.md`.
2. Confirm the change does not depend on `.ai-agent/` files loading automatically in Pi.
3. Confirm no active `.pi/settings.json` change is introduced without owner approval.
4. Confirm `.agents/skills/*/SKILL.md` adapters remain thin and point to canonical `.ai-agent/` packs.
5. If context files changed, include a note that Pi sessions must restart or run `/reload`.
6. Run the routing audit and include the result in the instruction-change report.
