# GitHub repository controls runbook

Use this file for repository settings, branch protection, CODEOWNERS, required checks, secret scanning, dependency review, Dependabot, and GitHub Project configuration.

Most repository controls are owner/admin actions. Do not change settings automatically unless the owner explicitly instructs you and permissions are verified.

## Recommended owner checklist

For `vnedyalk0v/pi-subagent-kernel`, consider these controls:

1. Protect `main`.
2. Require pull request before merge.
3. Require status checks before merge once CI exists.
4. Require branches to be up to date before merge if desired.
5. Require conversation resolution before merge.
6. Add `CODEOWNERS` with `vnedyalk0v` as owner for all files or sensitive paths.
7. Require Code Owner review if branch protection supports it.
8. Enable secret scanning and push protection where available.
9. Enable Dependabot security updates.
10. Enable dependency review / dependency review action once package manifests exist.
11. Ensure Codex automatic review is enabled for PRs.
12. Ensure the GitHub Project views exist.

## Agent behavior

If asked to configure repository controls:

1. Verify permissions.
2. Read current settings when possible.
3. Prepare a clear plan first.
4. Do not apply destructive or irreversible settings without owner confirmation.
5. Document manual steps if API/CLI support is missing.
6. Leave a summary comment or doc update with exact settings changed.

## CODEOWNERS suggestion

When owner approves, a simple starting point can be:

```text
* @vnedyalk0v
```

Sensitive paths can be made explicit later:

```text
AGENTS.md @vnedyalk0v
.ai-agent/** @vnedyalk0v
.github/** @vnedyalk0v
src/permissions/** @vnedyalk0v
src/backends/** @vnedyalk0v
package.json @vnedyalk0v
package-lock.json @vnedyalk0v
```

## Stop conditions

Stop and ask owner if:

- Admin permissions are missing.
- A setting could block future work unexpectedly.
- Required checks do not exist yet.
- A security feature requires paid plan/org settings.
- The requested setting conflicts with current workflow.
