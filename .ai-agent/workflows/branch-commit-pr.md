# Branch, commit, and PR workflow

Use this file when creating a branch, committing work, opening a PR, or updating an existing PR.

## Branch rules

Never work directly on `main`.

Before starting:

```bash
git checkout main
git pull --ff-only
```

Branch naming:

```text
issue-<number>/<short-kebab-summary>
```

Examples:

```text
issue-1/normalize-project-naming
issue-4/agent-definition-schema
issue-14/subagent-spawn-mock-backend
```

## Commit rules

Use small, reviewable commits. Prefer conventional-style messages:

```text
chore(docs): normalize project naming
feat(contracts): add AgentDefinition schema
test(safety): enforce default permission policy
fix(loader): reject duplicate agent names
```

## Small PR budget

Prefer one issue per branch and one issue per PR.

Stop and ask the owner or propose a split if:

- The PR touches unrelated areas.
- The diff becomes too large for a focused review.
- The task requires multiple milestones.
- The task changes both product code and instruction architecture.
- The task requires dependency changes unrelated to the issue.

## PR title

Format:

```text
M<milestone>: <imperative summary> (#<issue-number>)
```

Examples:

```text
M0: Normalize project naming (#1)
M1: Define AgentDefinition schema (#4)
M4: Implement subagent_spawn with mock backend (#14)
```

## PR body

Use `.ai-agent/templates/pr-body.md`.

Use `Closes #<issue-number>` only when the PR should close the issue on merge. Use `Refs #<issue-number>` when related but incomplete.

## Metadata mirroring

After opening, mirror issue metadata onto the PR:

- Assignee: `vnedyalk0v`
- Milestone
- Labels
- Project: `Pi SubAgent Kernel — Build Board`
- Project fields if available: `Status`, `Priority`, `Area`, `Phase`, `Risk`, `Source Doc`

Move PR project item to `In Review` when possible.

If metadata update fails, leave a PR comment with intended values and continue only if the owner allowed it.

## Do not

- Do not open a PR before local validation and `ponytail-review`, unless owner approved fallback.
- Do not post `@codex review` on open; auto-review is expected.
- Do not merge the PR.
- Do not publish packages.
- Do not bundle unrelated cleanup.
