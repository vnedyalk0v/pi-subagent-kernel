# Issue selection workflow

Read this when the owner asks you to pick the next task, continue work, or start implementation without naming a specific issue.

## Required inspection before choosing work

Do not guess repository state. Inspect open issues and PRs first.

Useful commands:

```bash
gh repo view --json nameWithOwner,url
gh issue list --state open --limit 100 --json number,title,labels,milestone,assignees
gh pr list --state open --json number,title,headRefName,assignees,isDraft,labels,milestone
```

If GitHub CLI is unavailable, use the available GitHub integration or the GitHub UI. If no reliable repo state is available, stop and ask the owner.

## Selection order

When the owner did not name an issue:

1. Do not start a new issue if an open PR already exists for that issue.
2. Choose the earliest milestone with open, unblocked issues.
3. Within that milestone, choose `priority:p0`, then `priority:p1`, then `priority:p2`, then `priority:p3`.
4. Within the same priority, choose the lowest issue number.
5. Skip issues labeled `status:blocked` or `status:needs-decision` unless the task is to unblock or decide them.
6. Respect dependencies listed in the issue body.
7. Prefer one issue per branch and one issue per PR.
8. If the issue is too large, propose a split before implementing.

## Planned milestone order

1. `M0 — Repo Hygiene & Governance` — `#1` to `#3`
2. `M1 — Contracts & Schemas` — `#4` to `#7`
3. `M2 — Pi Extension Shell` — `#8` to `#9`
4. `M3 — Agent Registry & Loader` — `#10` to `#12`
5. `M4 — Run Registry & Tool Surface` — `#13` to `#17`
6. `M5 — Mock Backend MVP` — `#18` to `#19`
7. `M6 — Safety Policy, Tests & CI` — `#20` to `#22`
8. `M7 — Subprocess Backend Alpha` — `#23` to `#24`
9. `M8 — Dogfood Alpha` — `#25` to `#26`
10. `M9 — Public Beta / npm Release` — `#27` to `#28`
11. `Post-MVP — Compat, Worktree, Workflows & UI` — `#29` to `#32`

Do not start Post-MVP work while MVP issues are open unless the owner explicitly asks.

## Assignment before work

All issues must be assigned to `vnedyalk0v` before work starts:

```bash
gh issue edit <issue-number> --add-assignee vnedyalk0v
```

If assignment fails, leave a readable issue comment and stop unless the owner explicitly allows continuing.

## Start-of-work comment

When useful, leave a concise issue comment:

```markdown
Starting work on this issue.

Instruction packs read:
- `.ai-agent/...`

Plan:
1. <step>
2. <step>

Validation expected:
- <commands>
```

Do not leave noise comments for trivial documentation fixes unless the workflow requires traceability.
