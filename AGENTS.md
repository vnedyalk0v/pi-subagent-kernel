# AGENTS.md — AI Coding Agent Workflow

These are repository-level instructions for every AI coding agent working in `vnedyalk0v/pi-subagent-kernel`, including Codex, Claude Code, Pi, Cursor, Copilot-style agents, or any other automated implementation agent.

The goal of this file is to make agent work traceable from issue → branch → pull request → automated review → fix loop → owner review.

## 1. Canonical project identity

Use these names exactly:

- Display name: **Pi SubAgent Kernel**
- Repository/package name: **pi-subagent-kernel**
- GitHub owner: **vnedyalk0v**
- GitHub repository: **vnedyalk0v/pi-subagent-kernel**
- Default branch: **main**

Do not introduce non-canonical historical project names or variants that change the spelling, capitalization, pluralization, or package slug above.

If you find inconsistent naming, create or update work under issue `#1` unless the current task explicitly says otherwise.

## 2. Authority and scope

1. Direct instructions from the repository owner in the current task override this file.
2. This file overrides general style preferences in lower-level documentation.
3. Issue acceptance criteria override broad roadmap language.
4. Source-backed facts in `docs/00-source-basis.md` must be treated differently from design recommendations.
5. Do not invent Pi APIs, GitHub automation behavior, package names, commands, or runtime support.
6. If an API or CLI behavior is not verified from docs, installed typings, source code, or local inspection, mark it as unverified and do not build production behavior on top of it.

## 3. Required read order before implementation

Before changing code or docs, read the relevant issue and then the source documents listed in that issue.

For a new task, use this default read order:

1. `README.md`
2. `AGENTS.md`
3. `CLAUDE.md`, if present
4. `docs/00-source-basis.md`
5. The issue body and all issue comments
6. The source docs listed in the issue
7. Related docs under `docs/`
8. Relevant files under `examples/agents/`
9. Existing implementation files, tests, and CI configuration

If `docs/github-tracking-setup.md` or `SETUP_TRACKING.md` exists, read it before changing project tracking metadata.

## 4. Current implementation order

Work must follow the milestone order unless the owner explicitly instructs otherwise.

Current planned order:

1. `M0 — Repo Hygiene & Governance` — issues `#1` to `#3`
2. `M1 — Contracts & Schemas` — issues `#4` to `#7`
3. `M2 — Pi Extension Shell` — issues `#8` to `#9`
4. `M3 — Agent Registry & Loader` — issues `#10` to `#12`
5. `M4 — Run Registry & Tool Surface` — issues `#13` to `#17`
6. `M5 — Mock Backend MVP` — issues `#18` to `#19`
7. `M6 — Safety Policy, Tests & CI` — issues `#20` to `#22`
8. `M7 — Subprocess Backend Alpha` — issues `#23` to `#24`
9. `M8 — Dogfood Alpha` — issues `#25` to `#26`
10. `M9 — Public Beta / npm Release` — issues `#27` to `#28`
11. `Post-MVP — Compat, Worktree, Workflows & UI` — issues `#29` to `#32`

Do not start Post-MVP work while MVP issues are still open unless the owner explicitly asks for it.

## 5. Issue selection rules

When the owner names an issue, work that issue. When the owner says to pick next or choose work, decide from repository state instead of guessing:

1. List open issues and open PRs first.
2. Do not start a new issue if there is already an open PR for the same issue.
3. Choose the earliest milestone with open, unblocked issues.
4. Within that milestone, choose by priority: `priority:p0`, then `priority:p1`, then `priority:p2`, then `priority:p3`.
5. Within the same priority, choose the lowest issue number.
6. Skip issues labeled `status:blocked` or `status:needs-decision` unless the current task is to unblock or decide them.
7. Respect explicit dependencies in the issue body.
8. Prefer one issue per branch and one issue per PR.
9. Do not bundle unrelated issues to reduce PR count.
10. If the issue is too large, propose a split before implementing.

Useful commands:

```bash
gh repo view --json nameWithOwner,url
gh issue list --state open --limit 100 --json number,title,labels,milestone,assignees
gh pr list --state open --json number,title,headRefName,assignees,isDraft
```

If the GitHub CLI is unavailable, use the available GitHub integration or the GitHub UI. Do not guess issue state.

## 6. Assignment rules

All issues and pull requests must be assigned to the owner:

```text
vnedyalk0v
```

Before starting work on an issue:

```bash
gh issue edit <issue-number> --add-assignee vnedyalk0v
```

After opening a PR:

```bash
gh pr edit <pr-number> --add-assignee vnedyalk0v
```

If assignment fails because of permissions or GitHub API limitations, leave a comment on the issue or PR explaining the failure and continue only if the owner explicitly allowed work to proceed.

## 7. Project board workflow

The project is:

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

When possible, keep project status synchronized:

1. `Backlog` — issue exists but work has not started.
2. `Ready` — issue is unblocked and ready for implementation.
3. `In Progress` — branch exists and implementation has started.
4. `In Review` — PR is open.
5. `Blocked` — work cannot continue without owner input or external dependency.
6. `Done` — PR is merged and the linked issue is closed.

Do not mark project items as `Done` before merge. If the project API is unavailable, add a short PR or issue comment with the intended status change.

## 8. Branch workflow

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

Use small, reviewable commits. Prefer commit messages like:

```text
chore(docs): normalize project naming
feat(contracts): add AgentDefinition schema
test(safety): enforce default permission policy
fix(loader): reject duplicate agent names
```

## 9. Issue title and PR title conventions

Issue titles should be imperative, scoped, and outcome-oriented.

Good issue titles:

```text
Define core AgentDefinition schema
Implement in-memory RunRegistry
Add CI workflow for build, typecheck, lint, and tests
```

Poor issue titles:

```text
Fix stuff
Implement everything
Subagents
Various improvements
```

PR titles must include the milestone prefix and issue number:

```text
M0: Normalize project naming (#1)
M1: Define AgentDefinition schema (#4)
M4: Implement subagent_spawn with mock backend (#14)
```

If a PR intentionally covers multiple issues, list every issue number in the title or body and explain why one PR is justified.

## 10. Pull request body requirements

Every PR body must include:

```markdown
## Linked issue
Closes #<issue-number>

## Summary
- <short bullet 1>
- <short bullet 2>

## Source docs
- `<doc path>`
- `<doc path>`

## Acceptance criteria evidence
- [ ] <criterion from issue>
- [ ] <criterion from issue>

## Tests and validation
- [ ] `npm run typecheck --if-present`
- [ ] `npm run lint --if-present`
- [ ] `npm run test --if-present`
- [ ] `npm run build --if-present`
- [ ] Other: <command or reason not run>

## Safety and scope check
- [ ] No unrelated changes
- [ ] No secret, token, or API key exposure
- [ ] No hidden chain-of-thought or private scratchpad content
- [ ] No unverified Pi API claims
- [ ] No npm publishing

## Pre-PR verifier gate
- [ ] Ran a fresh verifier subagent with `ponytail-review` against the final diff before opening the PR
- [ ] Fixed or documented every valid verifier finding

## Codex review loop
- [ ] Initial automatic `codex-connector bot` review completed
- [ ] Addressed, replied to, and resolved all valid `codex-connector bot` findings
- [ ] Requested re-review with `@codex review` after fixes, if findings required changes
- [ ] Latest `codex-connector bot` result after latest commit is `+1`
```

Use `Closes #<issue-number>` only when the PR should close the issue on merge. Use `Refs #<issue-number>` when the PR is related but should not close the issue.

## 11. Local validation rules

Run the strongest available local validation before opening or updating a PR.

If `package.json` exists, run:

```bash
npm run typecheck --if-present
npm run lint --if-present
npm run test --if-present
npm run build --if-present
```

If a command does not exist, do not invent it. Mark it as unavailable in the PR body.

For documentation-only changes, run relevant checks such as:

```bash
git diff --check
# Search the repository for any issue-specific forbidden strings.
```

Never claim that tests pass unless you ran them and saw a passing result. If tests cannot run, state the exact reason.

## 12. Pre-PR verifier gate

Before opening any PR, run a fresh subagent as an independent verifier over the final diff.

Required verifier behavior:

1. Use a new/fresh context, not the implementation context.
2. Use the `ponytail-review` skill (`/ponytail-review`) to hunt over-engineering and unnecessary complexity.
3. Give the verifier the issue number, acceptance criteria, files changed, and current diff.
4. Treat the verifier as a second gate before the GitHub PR review gate.
5. If the verifier says `Lean already. Ship.`, proceed.
6. If the verifier reports findings, validate them, fix every valid in-scope finding, rerun local validation, and rerun the verifier if the fix materially changes the diff.
7. If a finding is invalid or out of scope, document why in the PR body.

Do not open the PR until local validation and the verifier gate are complete, unless the owner explicitly allows skipping the verifier.

## 13. Opening a PR

Open a PR only after:

1. The issue is assigned to `vnedyalk0v`.
2. The branch is based on current `main`.
3. The implementation is limited to the linked issue.
4. Local validation has passed or unavailable checks are documented.
5. The pre-PR verifier subagent has passed, or any valid findings are fixed.
6. The PR body includes `Closes #<issue-number>` or a clear reason for using `Refs` instead.

Recommended command shape:

```bash
gh pr create \
  --title "M<milestone-number>: <short title> (#<issue-number>)" \
  --body-file <prepared-pr-body.md> \
  --base main \
  --head <branch-name>
```

After opening, immediately mirror the linked issue metadata onto the PR:

```bash
gh pr edit <pr-number> \
  --add-assignee vnedyalk0v \
  --milestone "<issue milestone>" \
  --add-label "<comma-separated issue labels>" \
  --add-project "Pi SubAgent Kernel — Build Board"
```

Do not rely on the linked issue metadata alone. The PR itself must have the same milestone, labels, assignee, and project link unless the PR intentionally differs and the body explains why.

Move the PR project item to `In Review` if project access is available. Copy project fields from the issue when present: `Priority`, `Area`, `Phase`, `Risk`, and `Source Doc`. Then follow the automated review loop below. Do not post an initial `@codex review`: Codex starts automatically when the PR opens. If work cannot continue, use `Blocked` and leave a readable blocker comment.

## 14. Automated AI review loop: `codex-connector bot`

Every PR must go through the automated AI review loop.

The expected review bot is:

```text
codex-connector bot
```

### Core rule

Opening a PR automatically triggers Codex review. Do **not** post an initial `@codex review` comment.

While review is running, the PR or review trigger shows an 👀 (`eyes`) reaction. If you see 👀 and there is no later `codex-connector bot` result for the current head commit, review is in progress. Wait and poll. Do not post another trigger.

A Codex result is one of:

1. `+1` / thumbs-up / “didn't find any major issues” after the current head commit — the automated review gate is satisfied.
2. One or more review comments/threads — validate and handle every finding.

### Useful checks

```bash
gh pr view <pr-number> --json number,title,headRefOid,comments,reviews,statusCheckRollup

gh api repos/vnedyalk0v/pi-subagent-kernel/issues/<pr-number>/comments \
  --jq '.[] | {id, user: .user.login, body, reactions: .reactions, created_at}'

gh api repos/vnedyalk0v/pi-subagent-kernel/pulls/<pr-number>/reviews

gh api graphql -f query='query($owner:String!, $repo:String!, $number:Int!) { repository(owner:$owner, name:$repo) { pullRequest(number:$number) { reviewThreads(first:50) { nodes { id isResolved path comments(first:10) { nodes { author { login } body createdAt } } } } } } }' \
  -F owner=vnedyalk0v -F repo=pi-subagent-kernel -F number=<pr-number>
```

### Review loop steps

1. Open the PR.
2. Mirror issue metadata onto the PR and project item.
3. Wait for the automatic Codex review. Do not post `@codex review` while 👀 indicates review is in progress.
4. If Codex returns `+1` for the current head commit and there are no unresolved valid findings, the automated review gate is complete.
5. If Codex returns review comments, read every comment and review thread.
6. Validate each finding against code, tests, issue acceptance criteria, and source docs.
7. Fix every valid in-scope finding with the smallest safe change.
8. Reply to each bot review thread with what changed, why it is out of scope, or why it is invalid, including the commit SHA when code changed.
9. Immediately resolve each replied-to review thread, equivalent to clicking **Resolve conversation**. If permission is missing, leave a blocker comment and stop.
10. After fixes are pushed and all addressed threads are resolved, request one re-review by posting exactly:

```text
@codex review
```

11. Wait for the new Codex result. If 👀 is present, do not post another trigger.
12. Repeat until the latest Codex result after the latest head commit is `+1` and no valid bot findings remain unresolved.

### How to handle bot findings

Classify each finding as one of these:

1. **Valid and in scope** — fix it, test it, reply with evidence, then resolve the review thread.
2. **Valid but out of scope** — reply with evidence, open or propose a follow-up issue, then resolve the review thread unless owner input is required.
3. **Duplicate or outdated** — reply with evidence that it is already handled or no longer applies, then resolve the review thread.
4. **Invalid** — reply with a concise explanation and evidence, then resolve the review thread. Do not change code just to satisfy an invalid finding.
5. **Ambiguous** — ask for owner direction and mark the PR or issue blocked if needed. Resolve only after the ambiguity is answered.
6. **Unsafe suggestion** — do not apply it. Explain the safety concern, request owner direction, and leave the thread unresolved until directed.

A bot comment is not valid merely because it exists. Replying to a bot review thread is not complete until the thread is resolved or explicitly left unresolved because it is blocked on owner direction.

### Re-review rule

Only request re-review after Codex posted review comments and you have fixed/replied/resolved the findings. Before posting `@codex review`, verify there is no in-progress Codex run for the current head commit. If 👀 is present and no later bot result exists, wait.

Never post more than one `@codex review` for the same head commit unless the owner explicitly instructs you to do so.

### Waiting, blocker comments, and formatting

Do not pretend that a bot review happened. If the bot does not respond after a reasonable polling window, leave a readable PR comment from a body file and wait for owner direction.

For multi-line PR or issue comments, use a heredoc/body file. Do not pass literal `\n` sequences in a quoted shell string; GitHub renders them as ugly text.

```bash
cat > /tmp/pr-comment.md <<'EOF'
### Blocked

**Reason**
<specific reason>

**Evidence**
- <link or command output>

**Options**
1. <option>
2. <option>
EOF

gh pr comment <pr-number> --body-file /tmp/pr-comment.md
```

### Completion rule

The automated review loop is complete only when all of these are true:

1. The latest `codex-connector bot` result was created after the latest commit.
2. The latest bot result is `+1`, thumbs-up, or “didn't find any major issues”.
3. There are no unresolved valid bot findings or unresolved bot review threads.
4. Required checks pass or unavailable checks are documented.
5. The PR is assigned to `vnedyalk0v`.
6. The linked issue is assigned to `vnedyalk0v`.

## 15. Human owner review and merge rules

Do not merge PRs unless the owner explicitly instructs you to merge.

After the automated review loop is complete:

1. Ensure the PR is not missing required metadata.
2. Ensure the PR has a linked issue.
3. Ensure all valid bot findings are resolved.
4. Ensure local and CI checks pass or limitations are documented.
5. Leave a final PR comment summarizing readiness for owner review.

Suggested final comment:

```markdown
Ready for owner review.

- Linked issue: #<issue-number>
- Validation: <commands run>
- Codex review: latest result is +1 after commit <sha>
- Remaining limitations: <none or list>
```

## 16. Implementation guardrails

Keep the implementation narrow and staged.

Do:

1. Build small modules with stable interfaces.
2. Add runtime validation for public inputs.
3. Add tests for success and failure cases.
4. Keep safety decisions in code and schemas, not only prompts.
5. Preserve context isolation by default.
6. Make result details structured and inspectable.
7. Keep docs in sync with implemented behavior.
8. Prefer deterministic behavior over prompt-only conventions.

Do not:

1. Build a full workflow/DAG engine before one-off subagent runs are stable.
2. Add remote workers before local backends are reliable.
3. Add worktree write behavior before permissions and run lifecycle are tested.
4. Add automatic proactive delegation in MVP.
5. Let child agents silently escalate permissions.
6. Pass the full parent transcript to a child unless explicitly requested through `inheritContext: full`.
7. Auto-install unknown packages, extensions, or MCP servers from agent definitions.
8. Publish to npm before the release milestone explicitly allows it.
9. Store active runs only in memory while claiming durability.
10. Copy features from third-party packages without tests and a migration path.

## 17. Safety defaults that must not regress

The default policy must remain deny-by-default unless an issue explicitly changes it and tests prove the behavior.

Required defaults:

```text
maxDepth = 1
maxThreads = 4
nestedSubagents = false
filesystem = read-only
network = none
childExtensions = deny-by-default
mcpServers = allowlist-only
projectAgentsRequireConfirmation = true
```

Any change that relaxes these defaults is security-sensitive and must be labeled or treated as `type:security` and `area:safety`.

## 18. Recommended source layout

Use this layout unless an accepted issue or PR changes it:

```text
src/
  index.ts
  extension.ts
  contracts/
    agent-definition.ts
    run-envelope.ts
    run-state.ts
    run-event.ts
    permission-policy.ts
    execution-backend.ts
    artifacts.ts
    model-route.ts
    index.ts
  registry/
    agent-registry.ts
    run-registry.ts
  loaders/
    pi-agent-loader.ts
    claude-agent-loader.ts
    codex-agent-loader.ts
  backends/
    execution-backend.ts
    mock-backend.ts
    sdk-backend.ts
    subprocess-backend.ts
  tools/
    subagent-spawn.ts
    subagent-status.ts
    subagent-result.ts
    subagent-cancel.ts
  commands/
  permissions/
  context/
  observability/

tests/
  contracts/
  registry/
  loaders/
  backends/
  tools/
```

Do not create directories for future features unless the current issue needs them.

## 19. MVP coding priorities

Build in this order:

1. Repository hygiene and governance.
2. Static contracts and runtime validation.
3. Permission policy defaults.
4. Backend interface.
5. TypeScript package skeleton.
6. Pi extension shell.
7. Agent registry.
8. `.pi/agents/*.md` loader.
9. Run registry and lifecycle state machine.
10. Mock backend.
11. `subagent_spawn` with mock backend.
12. `subagent_status`.
13. `subagent_result`.
14. `subagent_cancel`.
15. Safety policy enforcement in the spawn path.
16. Unit tests and CI.
17. Subprocess backend research.
18. Subprocess backend alpha.

Do not implement Claude/Codex importers, worktree backend, workflow engine, FleetView, remote workers, or npm release before the relevant milestone.

## 20. Documentation rules

Documentation must describe what is true now, not what might exist later.

Use precise language:

- `Implemented` only for working, tested behavior.
- `Planned` for accepted but not implemented behavior.
- `Proposed` for design ideas not yet accepted.
- `Verified` only for facts backed by official docs, source code, package typings, or local inspection.
- `Package-author claim` for third-party README/package-page claims not independently audited.

When adding or changing architecture claims, update `docs/00-source-basis.md` if the claim depends on external facts.

## 21. Secrets, privacy, and chain-of-thought

Never commit:

1. API keys, tokens, credentials, cookies, or private URLs.
2. Raw logs that may contain secrets.
3. Hidden chain-of-thought or private scratchpad content.
4. Private prompts from external systems unless explicitly provided for repo documentation.
5. User-private data unrelated to the issue.

If a secret is accidentally exposed, stop, notify the owner in the PR or issue, and do not continue until directed.

## 22. Handling uncertainty and blockers

Stop and ask for owner direction when:

1. GitHub permissions are missing for assignment, project fields, or review-thread resolution.
2. The issue acceptance criteria conflict with repository docs.
3. The bot review conflicts with safety policy or source-backed docs.
4. The implementation requires an unverified Pi API.
5. The task would expand beyond the linked issue.
6. CI fails for reasons unrelated to the PR.
7. A release, npm publish, or irreversible repo setting change is required.

When blocked, leave a concise issue or PR comment from a body file with:

```markdown
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
```

## 23. Definition of done

A PR is ready for owner review only when:

1. It links the correct issue with `Closes #<issue-number>` or explains why it uses `Refs`.
2. The linked issue and PR are assigned to `vnedyalk0v`.
3. The PR title follows the repository convention.
4. The PR body includes source docs, acceptance criteria evidence, tests, and safety checks.
5. The change is limited to the issue scope.
6. Docs are updated for user-visible behavior.
7. Runtime validation rejects invalid public input where applicable.
8. Unit tests cover success and failure cases where applicable.
9. Integration or simulated flow tests are added where the issue calls for behavior changes.
10. No logs or artifacts include secrets, API keys, or hidden chain-of-thought content.
11. Local validation and CI pass, or unavailable checks are explicitly documented.
12. The pre-PR verifier subagent ran with `ponytail-review`, and every valid finding is fixed or documented.
13. All valid `codex-connector bot` findings are fixed or answered with evidence.
14. The latest bot result after the latest commit is `+1`.
15. Project status is `In Review` or the inability to update it is documented.

Do not mark an issue complete before its PR is merged.
