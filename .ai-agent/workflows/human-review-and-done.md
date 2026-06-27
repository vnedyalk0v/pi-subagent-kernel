# Human owner review and done rules

Read this when the automated review loop is complete or when preparing a PR for owner review.

## Merge authority

Do not merge PRs unless the owner explicitly instructs you to merge.

## Before owner review

Verify:

1. PR title follows convention.
2. PR body is complete.
3. Correct issue is linked with `Closes` or `Refs`.
4. Issue and PR are assigned to `vnedyalk0v`.
5. PR metadata mirrors issue metadata where appropriate.
6. Project status is `In Review`, or inability to update it is documented.
7. Local validation and CI pass, or unavailable checks are documented.
8. Pre-PR verifier gate is complete.
9. Latest `codex-connector bot` result after latest commit is `+1`.
10. All valid bot findings are fixed or answered with evidence.
11. No secrets, private chain-of-thought, or unrelated changes are present.

## Final owner-review comment

Use `.ai-agent/templates/final-owner-review-comment.md`.

Suggested comment:

```markdown
Ready for owner review.

- Linked issue: #<issue-number>
- Validation: <commands run>
- Pre-PR verifier: <passed/fallback documented>
- Codex review: latest result is +1 after commit <sha>
- Remaining limitations: <none or list>
```

## Done status

Do not mark issue/project item as `Done` before the PR is merged and the linked issue is closed.

If the owner asks you to close an issue manually, verify there is no open PR that still needs it.
