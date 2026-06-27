# Codex review severity taxonomy

Use this file when validating `codex-connector bot`, Copilot, Claude, human, or other automated review comments.

## Purpose

Codex review is expected to focus on high-priority P0/P1 issues. This repository defines those severities to avoid over-fixing minor suggestions or ignoring serious risks.

## P0 — Critical, must block PR

Examples:

- Secret, token, credential, cookie, private URL, or private data exposure.
- Hidden chain-of-thought or private scratchpad content committed or posted.
- AI agent allowed to merge or publish without explicit owner instruction.
- Safety defaults relaxed without explicit issue/owner authority and tests.
- Child agent permission escalation.
- Full parent transcript passed to child by default.
- Production behavior based on unverified Pi API/CLI behavior.
- Dependency or script with clear supply-chain risk added without approval.
- CI/test bypass that hides failure.
- npm publish/tag/release performed out of milestone or without owner approval.

Action: fix or block. Do not resolve without evidence.

## P1 — High, should block owner-review readiness

Examples:

- Missing validation for public inputs or schemas.
- Missing tests for safety defaults, lifecycle states, or error paths.
- Incorrect issue/PR linkage that breaks traceability.
- Stale Codex `+1` from an older commit.
- PR opened without `ponytail-review` or approved fallback.
- Unresolved valid review thread.
- Docs claim implemented behavior that is only planned.
- New dependency without dependency-gate evidence.
- Unsafe subprocess behavior lacking timeout/cancel/output handling.

Action: fix in PR if in scope; otherwise document and create/propose follow-up.

## P2 — Medium, may be follow-up

Examples:

- Small naming inconsistency not affecting package identity.
- Minor refactor suggestion.
- Missing comments for non-obvious but safe code.
- Test organization improvement.
- Non-blocking documentation clarity.

Action: fix if cheap and in scope; otherwise follow-up.

## P3 — Low / nice-to-have

Examples:

- Style preferences not covered by project standards.
- Optional polish.
- Alternative implementation preference without correctness/safety impact.

Action: do not churn code just to satisfy P3. Document if ignored.

## Invalid finding criteria

A finding may be invalid if:

- It relies on a false fact.
- It contradicts issue acceptance criteria.
- It contradicts root `AGENTS.md` or safety policy.
- It asks for out-of-scope work.
- It suggests a less safe behavior.
- It is already fixed in the current head.

Always reply with evidence before resolving.
