# Pre-PR verifier gate

Read this before opening any PR.

## Purpose

Before the GitHub PR review gate, run a fresh independent verifier over the final diff. This prevents implementation-context bias and catches over-engineering before the PR is opened.

## Required verifier

Use the `ponytail-review` skill or command:

```text
/ponytail-review
```

The verifier must run in a fresh context, not the implementation context.

## Input to verifier

Provide:

- Issue number.
- Issue acceptance criteria.
- Source docs reviewed.
- Files changed.
- Current diff.
- Validation commands already run.
- Any known limitations.

## Required behavior

1. If verifier says `Lean already. Ship.`, proceed.
2. If verifier reports findings, validate each finding.
3. Fix every valid in-scope finding with the smallest safe change.
4. Rerun local validation after fixes.
5. Rerun verifier if fixes materially change the diff.
6. If a finding is invalid or out of scope, document why in the PR body.
7. If `ponytail-review` is unavailable, stop before opening the PR and ask the owner to enable it or approve a one-time fallback.

Do not silently substitute another review tool.

## PR body evidence

The PR body must say:

```markdown
## Pre-PR verifier gate
- [ ] Ran fresh verifier with `ponytail-review` against final diff
- [ ] Fixed or documented every valid verifier finding
- [ ] If unavailable, owner-approved fallback documented
```
