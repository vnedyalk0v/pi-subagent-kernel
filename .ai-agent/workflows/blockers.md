# Blockers and owner decisions

Read this when work cannot safely continue.

## Stop and ask for owner direction when

1. GitHub permissions are missing for assignment, project fields, review-thread resolution, or PR metadata.
2. Issue acceptance criteria conflict with repository docs.
3. Bot review conflicts with safety policy or source-backed docs.
4. Implementation requires an unverified Pi API.
5. Task would expand beyond the linked issue.
6. CI fails for reasons unrelated to the PR.
7. A release, npm publish, irreversible repository setting, or credential change is required.
8. `ponytail-review` is unavailable before PR open.
9. Automatic Codex review is expected, no current-head Codex comment/review/check/reaction/timeline signal appears after the Codex polling window, and no current-head 👀 / in-progress signal is visible.
10. A bot suggestion appears unsafe.

## Blocker comment requirements

Use `.ai-agent/templates/blocker-comment.md`.

The comment must include:

- Specific reason.
- Evidence: command output, file path, link, or exact observed state.
- Options.
- Recommended path.

For multi-line comments, use a heredoc/body file. Do not pass literal `\n` sequences inside a quoted shell string.

```bash
cat > /tmp/blocker-comment.md <<'EOF'
### Blocked

**Reason**
<specific reason>

**Evidence**
- <command output, file path, or link>

**Options**
1. <option>
2. <option>

**Recommended**
<one recommendation>
EOF

gh pr comment <pr-number> --body-file /tmp/blocker-comment.md
```

## Project status

If project access is available, set status to `Blocked`. If unavailable, mention the intended project status in the blocker comment.

Do not set `Blocked` for a PR that is merely waiting on Codex while a current-head 👀 / in-progress signal exists; leave the issue and PR `In Review` and keep polling.
