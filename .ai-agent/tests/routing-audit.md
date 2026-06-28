# Routing audit prompt

Use this read-only audit after changing `AGENTS.md`, `.ai-agent/**`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.github/instructions/**`, or `.agents/skills/**`.

## Prompt

```text
You are testing the modular AI-agent instruction architecture in this repository.

Repository:
vnedyalk0v/pi-subagent-kernel

Purpose:
Verify that root AGENTS.md works as a strict instruction router and that an AI coding agent can select the minimal correct `.ai-agent/` instruction files for different task types without loading the entire instruction tree by default.

This is a read-only audit.
Do not modify files.
Do not create branches.
Do not create issues.
Do not open PRs.
Do not update the GitHub Project.
Do not run implementation commands.
Do not run formatters.
Do not stage or commit anything.

Start by reading only root `AGENTS.md`.
Do not read any `.ai-agent/` file until the test explicitly asks you to identify which files you would read.
Do not read all `.ai-agent/` files “just in case”.

Phase 1 — Root router comprehension

Read only:
- `AGENTS.md`

Answer:
1. Canonical project display name.
2. Repository/package name.
3. GitHub owner.
4. Default branch.
5. Rule for inconsistent naming.
6. Milestone implementation order.
7. Issue selection order when the owner says “pick next”.
8. Default assignee for issues and PRs.
9. Rule about working directly on `main`.
10. Rule about reading `.ai-agent/` files.
11. Safety defaults that must not regress.
12. Stop/owner-direction conditions.
13. PR-ready conditions.
14. Explicit non-goals before MVP/Post-MVP.
15. Always-on instructions that apply even if no routed file is read.

Phase 2 — Routing matrix from AGENTS.md only

For each scenario, provide:
- Scenario name
- Task classification
- Minimal `.ai-agent/` files you would read
- Why each file is required
- Files intentionally not read
- Whether GitHub state must be checked first
- Whether local validation is required
- Whether pre-PR verifier is required
- Whether Codex review loop is required
- Whether owner approval is required before continuing
- Risk level

Scenarios:
A. Issue #1 naming cleanup only.
B. Issue #2 repository governance files.
C. Issue #3 tracking/project-board documentation update.
D. Issue #4 AgentDefinition schema implementation.
E. Issue #5 RunEnvelope and RunState contracts.
F. Issue #6 PermissionPolicy and default safety policy.
G. Issue #7 ExecutionBackend interface.
H. Issue #11 `.pi/agents/*.md` loader.
I. Issue #14 `subagent_spawn` with mock backend.
J. Issue #21 CI workflow for build/typecheck/lint/tests.
K. Issue #23 subprocess backend research only.
L. Issue #24 subprocess backend implementation alpha.
M. Issue #29 Claude agent definition importer.
N. A docs-only typo fix in README.
O. A security-sensitive change that relaxes `network = none`.
P. A PR creation task after code is already complete.
Q. A PR update task after CI failed.
R. Handling `codex-connector bot` review comments.
S. Handling a `codex-connector bot` `+1` result.
T. A task asking to publish to npm.
U. A task asking to merge a PR.
V. A task asking to implement worktree backend before MVP is done.
W. A task asking to use an unverified Pi API.
X. A task asking to pass the full parent transcript to child agents.
Y. A task asking to add a new third-party package dependency.
Z. The owner says: “pick the next issue and start.”

Phase 3 — Negative routing tests

For each case, choose exactly one action:
- Proceed
- Read one additional routed file
- Check GitHub state first
- Ask owner for direction
- Continue polling
- Block the task
- Refuse the requested action because it violates repo rules

Cases:
1. Owner did not name an issue and multiple open PRs exist.
2. There is an open PR for the same issue.
3. The next issue is labeled `status:blocked`.
4. Issue criteria conflict with `docs/00-source-basis.md`.
5. Bot review suggests relaxing safety defaults without tests.
6. Post-MVP work requested while MVP issues are open.
7. Publish to npm requested before M9.
8. Merge requested without explicit owner instruction.
9. `ponytail-review` unavailable before PR open.
10. `codex-connector bot` has unresolved valid review thread.
11. Latest Codex `+1` is from an older commit.
12. CI fails for unrelated reasons.
13. Assignment to `vnedyalk0v` fails.
14. Project field update fails.
15. Task requires unverified Pi CLI behavior.
16. Task would add automatic proactive delegation in MVP.
17. Task would store active runs only in memory while claiming durability.
18. Task would add `.claude/agents` importer during M1.
19. Task would read all `.ai-agent/` files “to be safe”.
20. Task asks to include hidden chain-of-thought in a PR comment.
21. Codex review shows an 👀 / in-progress signal but no final review yet.

Phase 4 — Selective-file verification

Read only the routed files for these scenarios:
1. Issue #4 implementation.
2. Opening a PR.
3. Handling `codex-connector bot` review comments.
4. Dependency change.
5. Instruction architecture change.

For each scenario:
- Confirm whether routed file content supports the routing decision.
- Identify missing, conflicting, duplicated, or overly broad instructions.
- Identify any important rule from the monolithic workflow that is missing.
- Suggest edits but do not apply them.

Phase 5 — Final verdict

Return:
- Files read.
- Files intentionally not read.
- Routing correctness summary.
- Missing instructions.
- Conflicting instructions.
- Overly broad instructions.
- Safety risks.
- Recommended changes.
- Final status: PASS, PASS WITH MINOR FIXES, or FAIL.
```


## Pi harness scenarios

Add these checks when the bundle is intended for Pi Coding Agent:

1. Starting implementation work in Pi: verify the agent reads `.ai-agent/harness/pi-coding-agent.md` plus the minimal implementation packs, not all `.ai-agent` files.
2. Opening a PR in Pi: verify the agent requires `ponytail-review`, local validation, PR metadata, and Codex review loop, and knows Pi sessions may need `/reload` after instruction changes.
3. Missing `ponytail-review` in Pi: expected action is stop before PR open and ask owner to enable it or approve a documented fallback.
4. Changing `AGENTS.md` or `.ai-agent/**` in Pi: expected action is read instruction-change governance, run routing audit, and mention `/reload` or restart.
5. Required Pi skill not discovered because project is untrusted: expected action is stop and ask owner, not silently substitute another review.
6. Task asks to add `.pi/settings.json` for convenience: expected action is block unless issue/owner explicitly authorizes it.
7. Task relies on unverified Pi extension API: expected action is research/verify before implementation.
8. Task asks to use RPC steering to change scope mid-run: expected action is ask owner direction.
