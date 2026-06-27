# GitHub Project board workflow

Read this when changing GitHub Project metadata, issue/PR status, milestones, labels, or project fields.

## Project identity

Project name:

```text
Pi SubAgent Kernel — Build Board
```

Expected fields:

- `Status`
- `Priority`
- `Area`
- `Phase`
- `Risk`
- `Source Doc`

## Status meanings

- `Backlog` — issue exists but work has not started.
- `Ready` — issue is unblocked and ready for implementation.
- `In Progress` — branch exists and implementation has started.
- `In Review` — PR is open.
- `Blocked` — work cannot continue without owner input or external dependency.
- `Done` — PR is merged and linked issue is closed.

Never mark an item `Done` before merge.

## Synchronization rules

1. When starting work, move the issue to `In Progress` if project access is available.
2. When opening a PR, add the PR to the project and move it to `In Review`.
3. Mirror issue metadata onto the PR: assignee, labels, milestone, project, and relevant project fields.
4. When blocked, set status to `Blocked` and leave a blocker comment.
5. After merge/issue closure, status may be `Done`.

## If project API is unavailable

Do not silently skip project updates. Add a short issue or PR comment:

```markdown
Project update unavailable.

Intended status: `<status>`
Reason: <permission/API/tool limitation>
```

Then continue only if the owner previously allowed work to proceed without project updates.

## Useful commands

```bash
gh project list --owner vnedyalk0v
gh issue view <issue-number> --json number,title,labels,milestone,assignees,projectItems
gh pr view <pr-number> --json number,title,labels,milestone,assignees,projectItems
```

Project field editing often requires GraphQL or `gh project item-edit`. Verify exact field IDs before editing. Do not invent project API behavior.
