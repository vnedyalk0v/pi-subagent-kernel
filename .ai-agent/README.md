# `.ai-agent/` instruction packs

This directory contains task-routed instructions for AI coding agents.

Root `AGENTS.md` is the always-on router. These files are **not** meant to be bulk-loaded on every task.

## Read discipline

1. Read root `AGENTS.md` first.
2. Read the relevant harness adapter only if the current harness matters.
3. Use `.ai-agent/routing.md` or `.ai-agent/routing-manifest.json` only when routing is not obvious.
4. Read the smallest sufficient instruction pack set.
5. Do not read release, review, dependency, subprocess, or instruction-change packs unless the task needs them.
6. Report `Instruction packs read` in the first plan or PR body.

## Harness adapters

- Pi Coding Agent: `.ai-agent/harness/pi-coding-agent.md`
- Codex: `.ai-agent/harness/codex.md`
- Claude Code: `.ai-agent/harness/claude-code.md`
- Copilot: `.ai-agent/harness/copilot.md`
- Unknown harness: `.ai-agent/harness/README.md`

Harness adapters contain operational caveats only. They do not override root `AGENTS.md`.

## Main pack groups

- `core/` — identity, safety defaults, privacy, documentation/source policy.
- `workflows/` — issue selection, project board, branch/PR, pre-PR verifier, Codex review loop, blockers, CI triage, instruction changes.
- `implementation/` — engineering principles, MVP order, source layout, contracts, testing.
- `security/` — dependency gate, release guardrails, prompt injection / untrusted input.
- `review/` — Codex review severity taxonomy.
- `github/` — repository controls runbook.
- `harness/` — Pi/Codex/Claude/Copilot adapters.
- `templates/` — reusable comment/PR/report templates.
- `tests/` — routing audit prompts and expected routing.
- `research/` — verified assumptions and source notes.

## What not to read by default

- Do not read `security/release-guardrails.md` unless release/npm is in scope.
- Do not read `workflows/codex-review-loop.md` unless a PR exists or bot feedback is in scope.
- Do not read `security/dependency-gate.md` unless dependencies or lockfiles change.
- Do not read `github/repository-controls.md` unless repository settings or branch protection are in scope.
- Do not read `tests/*` unless auditing instruction routing or changing instruction files.
- Do not read all harness adapters; read only the one for the current harness.
