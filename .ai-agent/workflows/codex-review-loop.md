# Codex review loop

Use this file for PR feedback from `codex-connector bot` or for checking whether a PR has passed automated AI review.

## Core rule

This repository is configured for Codex review on PR open and every push. Do **not** post an initial `@codex review` comment and do **not** post `@codex review` after pushing fixes unless the owner explicitly directs it or automatic review is confirmed unavailable after a blocker comment.

A PR is not ready for owner review until the latest `codex-connector bot` result after the latest commit is `+1` / thumbs-up / no major issues and no valid bot finding remains unresolved.

## Deterministic polling rule

For a current head commit:

1. Confirm the current head SHA before every polling pass.
2. Check all current-head Codex-owned signals, not only PR reviews: PR/issue comments, pull reviews, review comments/threads, status checks, reactions, and timeline events. Codex-owned means the actor, app, author, check name, or reaction user is `codex-connector`, `chatgpt-codex-connector`, or their bot form; ignore maintainer 👀 reactions and unrelated queued checks.
3. Treat Codex-owned 👀 / `eyes`, queued/in-progress checks, "review started" text, or any current-head `codex-connector bot` activity as automatic review activity. For signals without a commit ID, count them only when their timestamp is after the latest head push/review request; for review-comment reactions, use the parent comment `commit_id`; do not count stale signals from older heads.
4. Poll at least 3 times over at least 10 minutes unless a final Codex result appears sooner. Wait between polls according to harness capabilities; do not create background promises.
5. While any Codex-owned current-head in-progress signal exists and is not stalled, keep the PR/project `In Review`, continue polling, and do not post a blocker or manual trigger.
6. After the polling window, leave a blocker comment and ask the owner for direction if no Codex-owned current-head signal exists, if the only current-head Codex signals are failed/cancelled/error signals, or if the latest in-progress signal is stalled for 30 minutes without a new Codex update or final review.
7. Do not post more than one manual `@codex review` for the same head commit, and only do so after owner approval or confirmed auto-review failure.

## Useful checks

```bash
gh pr view <pr-number> --json number,title,headRefOid,comments,reviews,statusCheckRollup,updatedAt

gh api repos/vnedyalk0v/pi-subagent-kernel/issues/<pr-number>/comments --paginate \
  --jq '.[] | {id, user: .user.login, body, reactions: .reactions, created_at}'

gh api repos/vnedyalk0v/pi-subagent-kernel/issues/<pr-number>/comments --paginate --jq '.[].id' | while read -r comment_id; do
  gh api repos/vnedyalk0v/pi-subagent-kernel/issues/comments/$comment_id/reactions --paginate \
    -H 'Accept: application/vnd.github+json' \
    --jq ".[] | {comment_id: $comment_id, user: .user.login, content, created_at}"
done

gh api repos/vnedyalk0v/pi-subagent-kernel/issues/<pr-number>/reactions --paginate \
  -H 'Accept: application/vnd.github+json' \
  --jq '.[] | {id, user: .user.login, content, created_at}'

gh api repos/vnedyalk0v/pi-subagent-kernel/pulls/<pr-number>/reviews --paginate

gh api repos/vnedyalk0v/pi-subagent-kernel/pulls/<pr-number>/comments --paginate \
  --jq '.[] | {id, commit_id, user: .user.login, body, path, line, created_at}'

gh api repos/vnedyalk0v/pi-subagent-kernel/pulls/<pr-number>/comments --paginate --jq '.[] | [.id, .commit_id] | @tsv' | while read -r comment_id commit_id; do
  gh api repos/vnedyalk0v/pi-subagent-kernel/pulls/comments/$comment_id/reactions --paginate \
    -H 'Accept: application/vnd.github+json' \
    --jq ".[] | {comment_id: $comment_id, commit_id: \"$commit_id\", user: .user.login, content, created_at}"
done

gh api repos/vnedyalk0v/pi-subagent-kernel/issues/<pr-number>/timeline --paginate \
  --jq '.[] | select(.event == "reviewed" or .event == "commented") | {event, actor: (.actor.login // .user.login), user: .user.login, body, content, commit_id, state, created_at, submitted_at}'

gh api graphql -f query='query($owner:String!, $repo:String!, $number:Int!) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:50) { nodes { id isResolved path comments(first:10) { nodes { author { login } body createdAt } } } } } } }' \
  -F owner=vnedyalk0v -F repo=pi-subagent-kernel -F number=<pr-number>
```

## Review loop steps

1. Confirm the PR head SHA.
2. Check for existing Codex reviews/comments after that SHA.
3. If latest Codex result is `+1` for the current head and there are no unresolved valid findings, the automated gate is complete.
4. If Codex returns comments, read every comment and review thread.
5. Classify each finding using `.ai-agent/review/codex-severity-taxonomy.md`.
6. Validate each finding against code, tests, issue criteria, source docs, and safety policy.
7. Fix every valid in-scope finding with the smallest safe change.
8. Reply to each bot thread with what changed, why it is out of scope, or why it is invalid.
9. Resolve each replied-to review thread only when addressed or explicitly judged invalid/out-of-scope with evidence.
10. Run local validation.
11. Push fixes.
12. Wait for automatic Codex review for the new head.
13. Repeat until latest current-head result is `+1` and no valid bot findings remain unresolved.

## Finding classes

- **Valid and in scope** — fix it, test it, reply with evidence, resolve.
- **Valid but out of scope** — reply with evidence, open/propose follow-up, resolve unless owner input is required.
- **Duplicate or outdated** — reply with evidence, resolve.
- **Invalid** — reply with concise evidence, resolve.
- **Ambiguous** — ask owner and mark blocked if needed.
- **Unsafe suggestion** — do not apply; explain safety concern and ask owner.

A bot comment is not valid merely because it exists.

## Completion rule

The automated review loop is complete only when:

1. The latest `codex-connector bot` result was created after the latest commit.
2. The latest result is `+1`, thumbs-up, or “didn't find any major issues”.
3. There are no unresolved valid bot findings.
4. Required checks pass or unavailable checks are documented.
5. The PR and linked issue are assigned to `vnedyalk0v`.
