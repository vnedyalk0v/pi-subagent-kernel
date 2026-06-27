# CI failure triage workflow

Use this file when CI fails after a PR is opened or after a push.

## Goal

Fix the smallest real cause of failure without weakening tests, hiding failures, or expanding scope.

## Steps

1. Identify the PR number and current head SHA.
2. Fetch check status and failing job logs.
3. Determine whether the failure is caused by this PR, base-branch drift, flaky infrastructure, missing secrets, or unrelated repository breakage.
4. If unrelated or requiring owner/admin action, leave a blocker comment and stop.
5. If caused by this PR, reproduce locally when possible.
6. Fix the smallest in-scope cause.
7. Run local validation.
8. Push the fix.
9. Wait for CI and automatic Codex review on the new head commit.
10. Update the PR with concise evidence.

## Useful commands

```bash
gh pr view <pr-number> --json number,title,headRefOid,statusCheckRollup

gh run list --branch <branch-name> --limit 10

gh run view <run-id> --log-failed
```

Use available GitHub integration if `gh` is unavailable.

## Do not

- Do not delete tests to make CI green.
- Do not mark tests skipped unless the issue explicitly requires it and the PR explains why.
- Do not weaken type checks, lint rules, or safety assertions without owner approval.
- Do not claim CI passed before it actually passes.
- Do not push broad refactors while fixing a CI failure.

## Classification

- **PR-caused failure** — fix in the PR.
- **Base branch failure** — document and ask owner whether to rebase or wait.
- **Infrastructure failure** — rerun once if appropriate, then document.
- **Missing secret/permission** — stop and ask owner.
- **Flaky test** — document evidence; do not disable without approval.

Use `.ai-agent/templates/ci-failure-report.md` in PR comments.
