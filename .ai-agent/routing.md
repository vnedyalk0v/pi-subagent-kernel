# Instruction routing guide

Use this guide when root `AGENTS.md` does not make the correct routed files obvious.

## Core principle

Read the smallest sufficient set. Do not load `.ai-agent/` recursively.

## Step 1 — identify harness

If the harness matters, read exactly one adapter:

- Pi Coding Agent: `.ai-agent/harness/pi-coding-agent.md`
- Codex: `.ai-agent/harness/codex.md`
- Claude Code: `.ai-agent/harness/claude-code.md`
- Copilot: `.ai-agent/harness/copilot.md`
- Unknown: `.ai-agent/harness/README.md`

For Pi, read the adapter when the task involves implementation, shell validation, PR creation, skills, extensions, context reload, or Pi runtime behavior.

## Step 2 — identify workflow

- Pick next issue: `workflows/issue-selection.md`, `workflows/project-board.md`.
- Branch, commit, PR: `workflows/branch-commit-pr.md`, `workflows/pre-pr-verifier.md`, `templates/pr-body.md`.
- Existing PR feedback: `workflows/codex-review-loop.md`, `review/codex-severity-taxonomy.md`, `templates/codex-review-replies.md`.
- CI failure: `workflows/ci-failure-triage.md`, `implementation/testing-and-validation.md`, `templates/ci-failure-report.md`.
- Blocker: `workflows/blockers.md`, `templates/blocker-comment.md`.
- Instruction bundle change: `workflows/instruction-change-governance.md`, `tests/routing-audit.md`, `tests/expected-routing.md`.

## Step 3 — identify implementation domain

- General code: `implementation/engineering-principles.md`, `implementation/mvp-order-and-scope.md`, `implementation/source-layout.md`, `implementation/testing-and-validation.md`.
- Contracts/schemas: add `implementation/contracts-and-schemas.md`.
- Safety-sensitive: add `core/safety-defaults-and-privacy.md`, `security/untrusted-input-and-prompt-injection.md`.
- Dependency/lockfile: add `security/dependency-gate.md`, `templates/dependency-gate-report.md`.
- Docs-only: `core/source-and-documentation-policy.md`.

## Step 4 — stop if needed

Stop and ask owner direction when:

- Routing is ambiguous after reading this file and the manifest.
- A required harness capability is missing.
- A task asks for merge, publish, Post-MVP work, unverified Pi APIs, relaxed safety defaults, or full transcript inheritance before the relevant milestone.
- Required GitHub assignment/project/review-thread actions fail.
