# PR metadata repair workflow

Use this file when a PR already exists but is missing assignee, labels, milestone, project, linked issue, or correct title/body metadata.

## Goal

Repair traceability without changing product code unless the owner explicitly asks.

## Required metadata

Every PR should have:

- Assignee: `vnedyalk0v`
- Linked issue with `Closes #<issue>` or `Refs #<issue>`
- Milestone matching the linked issue, unless explained
- Labels matching the linked issue, unless explained
- Project: `Pi SubAgent Kernel — Build Board`
- Project status: `In Review`
- PR title: `M<milestone>: <imperative summary> (#<issue-number>)`

## Steps

1. Identify the linked issue from PR body, branch name, title, or comments.
2. If the linked issue is ambiguous, ask the owner.
3. Read issue labels, milestone, and assignee.
4. Update PR assignee, milestone, labels, project, and status.
5. If project field update fails, leave a PR comment with intended values.
6. Do not change source files unless explicitly asked.

## Useful commands

```bash
gh pr view <pr-number> --json number,title,body,labels,milestone,assignees,headRefName

gh issue view <issue-number> --json number,title,labels,milestone,assignees

gh pr edit <pr-number> --add-assignee vnedyalk0v
```

Add labels/milestone/project using available `gh` or GitHub integration. Do not guess field IDs.

## Completion

Leave a concise comment only if something could not be updated.
