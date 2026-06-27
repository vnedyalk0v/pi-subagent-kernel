# GitHub Tracking Setup
Setup date: **2026-06-26**
GitHub account/tool used: **vnedyalk0v** via GitHub CLI (`gh`) against `vnedyalk0v/pi-subagent-kernel`. `gh auth status` showed the required `project` scope.
Repository: <https://github.com/vnedyalk0v/pi-subagent-kernel>
Project: **Pi SubAgent Kernel — Build Board** — <https://github.com/users/vnedyalk0v/projects/9>
Project purpose: Track the implementation of the Pi SubAgent Kernel from documentation to MVP, alpha, and public beta.
Setup summary comment: <https://github.com/vnedyalk0v/pi-subagent-kernel/issues/3#issuecomment-4809417546>
## Source docs inspected
`README.md`, `AGENTS.md`, `CLAUDE.md`, `MANIFEST.md`, all files under `docs/`, and all example agent definitions under `examples/agents/` were reviewed before creating the tracking structure.
A naming-hygiene issue was created for canonical display/package naming. A setup-time grep did not find historical project-name variants, but README/package naming still needs normalization to the requested canonical names.
## Project fields
- Reused built-in `Status` field and updated options to: Backlog, Ready, In Progress, In Review, Blocked, Done.
- Created `Priority`, `Area`, `Phase`, `Risk`, and `Source Doc` fields.
- All initial issues were added to the project with `Status = Backlog`; Priority, Area, Phase, Risk, and Source Doc were populated from labels/source docs.
## Project views
GitHub CLI in this environment exposes project/field/item commands but no project view creation command. The project README documents the recommended views, but the saved views still need to be created manually:
1. **Backlog Table** — table layout, all open issues, grouped or sorted by Priority and Milestone.
2. **MVP Board** — board layout, filter `phase:mvp`, grouped by Status.
3. **Roadmap** — roadmap/table view grouped by Milestone.
4. **Safety & Quality** — table layout, filter `area:safety OR type:test OR area:ci OR type:security`.
## Milestones created/reused
- **M0 — Repo Hygiene & Governance** — created/reused. Repository setup, naming consistency, contribution docs, issue templates, CI skeleton, and project tracking.
- **M1 — Contracts & Schemas** — created/reused. Core TypeScript contracts and schemas for AgentDefinition, RunEnvelope, RunState, RunEvent, PermissionPolicy, ExecutionBackend, ToolAllowlist, ModelRoute, and ArtifactRef.
- **M2 — Pi Extension Shell** — created/reused. Minimal Pi extension entrypoint and registration shell for tools/commands, without full backend execution.
- **M3 — Agent Registry & Loader** — created/reused. In-memory AgentRegistry and .pi/agents/*.md loader using Markdown with YAML frontmatter.
- **M4 — Run Registry & Tool Surface** — created/reused. RunRegistry and canonical tools: subagent_spawn, subagent_status, subagent_result, and subagent_cancel.
- **M5 — Mock Backend MVP** — created/reused. Fake/mock execution backend that returns valid structured RunEnvelope objects for MVP testing and tool validation.
- **M6 — Safety Policy, Tests & CI** — created/reused. Mandatory safety defaults, policy enforcement tests, unit tests, typecheck, lint, build, and CI workflow.
- **M7 — Subprocess Backend Alpha** — created/reused. First real subprocess backend with isolated child execution, lifecycle tracking, cancellation, timeout handling, and structured output capture.
- **M8 — Dogfood Alpha** — created/reused. Manual and automated dogfood scenarios against a real repository using scout, reviewer, tester, and summarizer agents.
- **M9 — Public Beta / npm Release** — created/reused. Package metadata, README install instructions, npm pack validation, clean install test, and first public beta release.
- **Post-MVP — Compat, Worktree, Workflows & UI** — created/reused. Claude/Codex compatibility importers, worktree backend, workflow/DAG orchestration, FleetView or /agents UI, cost accounting, and advanced model routing.
## Labels created/reused
- `priority:p0` — created/reused. Critical path or blocking issue.
- `priority:p1` — created/reused. High-priority MVP work.
- `priority:p2` — created/reused. Important but not immediately blocking.
- `priority:p3` — created/reused. Nice-to-have or later work.
- `type:feature` — created/reused. New product or implementation capability.
- `type:bug` — created/reused. Incorrect behavior or regression.
- `type:docs` — created/reused. Documentation work.
- `type:test` — created/reused. Test coverage or test infrastructure.
- `type:chore` — created/reused. Maintenance or repo hygiene.
- `type:security` — created/reused. Safety, permissions, sandboxing, or security-sensitive work.
- `type:research` — created/reused. Investigation required before implementation.
- `area:contracts` — created/reused. Schemas, types, public interfaces.
- `area:extension` — created/reused. Pi extension entrypoint and registration.
- `area:registry` — created/reused. AgentRegistry or RunRegistry.
- `area:loader` — created/reused. Agent definition loading and validation.
- `area:backend` — created/reused. Execution backends.
- `area:tools` — created/reused. subagent_* tool surface.
- `area:safety` — created/reused. Permission policy and guardrails.
- `area:ci` — created/reused. CI, lint, typecheck, build.
- `area:tests` — created/reused. Unit/integration/dogfood tests.
- `area:docs` — created/reused. README and docs.
- `area:compat` — created/reused. Claude/Codex/OpenCode compatibility.
- `area:ui` — created/reused. /agents command, TUI, dashboard, FleetView.
- `area:release` — created/reused. Packaging, npm, versioning, release notes.
- `phase:mvp` — created/reused. Required for first usable MVP.
- `phase:alpha` — created/reused. Required for internal alpha.
- `phase:beta` — created/reused. Required for public beta.
- `phase:post-mvp` — created/reused. Explicitly not part of MVP.
- `status:ready` — created/reused. Ready for implementation.
- `status:blocked` — created/reused. Blocked by another issue or decision.
- `status:needs-decision` — created/reused. Requires a design/product decision.
## Issues created/reused
| # | Issue | Milestone | Labels | Source docs |
|---:|---|---|---|---|
| 1 | [#1 Normalize project naming across repository](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/1) | M0 — Repo Hygiene & Governance | `priority:p0`, `type:chore`, `area:docs`, `phase:mvp` | `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/01-product-brief.md`, `docs/14-release-packaging.md` |
| 2 | [#2 Add repository governance files](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/2) | M0 — Repo Hygiene & Governance | `priority:p1`, `type:chore`, `area:docs`, `phase:mvp` | `AGENTS.md`, `docs/10-implementation-plan.md`, `docs/14-release-packaging.md` |
| 3 | [#3 Create initial GitHub planning structure](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/3) | M0 — Repo Hygiene & Governance | `priority:p0`, `type:chore`, `area:docs`, `phase:mvp` | `README.md`, `AGENTS.md`, `docs/10-implementation-plan.md` |
| 4 | [#4 Define core AgentDefinition schema](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/4) | M1 — Contracts & Schemas | `priority:p0`, `type:feature`, `area:contracts`, `phase:mvp` | `docs/04-agent-definition-spec.md`, `docs/02-requirements.md`, `docs/07-context-safety-permissions.md`, `docs/11-test-plan.md`, `examples/agents/scout.md` |
| 5 | [#5 Define RunEnvelope and RunState contracts](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/5) | M1 — Contracts & Schemas | `priority:p0`, `type:feature`, `area:contracts`, `phase:mvp` | `docs/02-requirements.md`, `docs/03-architecture.md`, `docs/05-tool-api.md`, `docs/08-observability-ux.md`, `docs/11-test-plan.md` |
| 6 | [#6 Define PermissionPolicy contract and default safety policy](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/6) | M1 — Contracts & Schemas | `priority:p0`, `type:security`, `area:safety`, `area:contracts`, `phase:mvp` | `AGENTS.md`, `docs/07-context-safety-permissions.md`, `docs/02-requirements.md`, `docs/13-risk-register.md`, `docs/11-test-plan.md` |
| 7 | [#7 Define ExecutionBackend interface](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/7) | M1 — Contracts & Schemas | `priority:p0`, `type:feature`, `area:contracts`, `area:backend`, `phase:mvp` | `docs/03-architecture.md`, `docs/06-runtime-backends.md`, `docs/10-implementation-plan.md`, `docs/11-test-plan.md` |
| 8 | [#8 Create TypeScript package skeleton](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/8) | M2 — Pi Extension Shell | `priority:p0`, `type:chore`, `area:extension`, `area:ci`, `phase:mvp` | `README.md`, `docs/03-architecture.md`, `docs/10-implementation-plan.md`, `docs/14-release-packaging.md` |
| 9 | [#9 Implement minimal Pi extension entrypoint](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/9) | M2 — Pi Extension Shell | `priority:p0`, `type:feature`, `area:extension`, `phase:mvp` | `docs/00-source-basis.md`, `docs/03-architecture.md`, `docs/05-tool-api.md`, `docs/10-implementation-plan.md`, `docs/14-release-packaging.md` |
| 10 | [#10 Implement in-memory AgentRegistry](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/10) | M3 — Agent Registry & Loader | `priority:p0`, `type:feature`, `area:registry`, `phase:mvp` | `docs/02-requirements.md`, `docs/03-architecture.md`, `docs/10-implementation-plan.md`, `docs/11-test-plan.md` |
| 11 | [#11 Implement .pi/agents/*.md loader](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/11) | M3 — Agent Registry & Loader | `priority:p0`, `type:feature`, `area:loader`, `phase:mvp` | `docs/04-agent-definition-spec.md`, `docs/02-requirements.md`, `docs/10-implementation-plan.md`, `docs/11-test-plan.md`, `docs/ADR.md` |
| 12 | [#12 Add built-in MVP agent definitions](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/12) | M3 — Agent Registry & Loader | `priority:p1`, `type:feature`, `area:loader`, `area:docs`, `phase:mvp` | `docs/09-built-in-agents-and-workflows.md`, `docs/04-agent-definition-spec.md`, `docs/07-context-safety-permissions.md`, `examples/agents/scout.md`, `examples/agents/reviewer.md`, `examples/agents/tester.md`, `examples/agents/summarizer.md` |
| 13 | [#13 Implement in-memory RunRegistry](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/13) | M4 — Run Registry & Tool Surface | `priority:p0`, `type:feature`, `area:registry`, `phase:mvp` | `docs/02-requirements.md`, `docs/03-architecture.md`, `docs/08-observability-ux.md`, `docs/10-implementation-plan.md`, `docs/11-test-plan.md` |
| 14 | [#14 Implement subagent_spawn tool with mock backend](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/14) | M4 — Run Registry & Tool Surface | `priority:p0`, `type:feature`, `area:tools`, `area:backend`, `phase:mvp` | `docs/05-tool-api.md`, `docs/03-architecture.md`, `docs/07-context-safety-permissions.md`, `docs/10-implementation-plan.md`, `docs/11-test-plan.md` |
| 15 | [#15 Implement subagent_status tool](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/15) | M4 — Run Registry & Tool Surface | `priority:p1`, `type:feature`, `area:tools`, `phase:mvp` | `docs/05-tool-api.md`, `docs/08-observability-ux.md`, `docs/11-test-plan.md` |
| 16 | [#16 Implement subagent_result tool](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/16) | M4 — Run Registry & Tool Surface | `priority:p1`, `type:feature`, `area:tools`, `phase:mvp` | `docs/05-tool-api.md`, `docs/08-observability-ux.md`, `docs/11-test-plan.md` |
| 17 | [#17 Implement subagent_cancel tool](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/17) | M4 — Run Registry & Tool Surface | `priority:p1`, `type:feature`, `area:tools`, `phase:mvp` | `docs/05-tool-api.md`, `docs/06-runtime-backends.md`, `docs/10-implementation-plan.md`, `docs/11-test-plan.md` |
| 18 | [#18 Implement mock ExecutionBackend](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/18) | M5 — Mock Backend MVP | `priority:p0`, `type:test`, `area:backend`, `phase:mvp` | `docs/03-architecture.md`, `docs/10-implementation-plan.md`, `docs/11-test-plan.md` |
| 19 | [#19 Add local demo scenario using mock backend](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/19) | M5 — Mock Backend MVP | `priority:p2`, `type:docs`, `area:docs`, `area:backend`, `phase:mvp` | `README.md`, `docs/05-tool-api.md`, `docs/10-implementation-plan.md`, `docs/11-test-plan.md`, `docs/14-release-packaging.md` |
| 20 | [#20 Add unit tests for contracts and safety defaults](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/20) | M6 — Safety Policy, Tests & CI | `priority:p0`, `type:test`, `area:tests`, `area:safety`, `phase:mvp` | `AGENTS.md`, `docs/07-context-safety-permissions.md`, `docs/11-test-plan.md`, `docs/13-risk-register.md` |
| 21 | [#21 Add CI workflow for build, typecheck, lint, and tests](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/21) | M6 — Safety Policy, Tests & CI | `priority:p0`, `type:chore`, `area:ci`, `phase:mvp` | `AGENTS.md`, `docs/10-implementation-plan.md`, `docs/11-test-plan.md`, `docs/14-release-packaging.md` |
| 22 | [#22 Implement safety policy enforcement in spawn path](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/22) | M6 — Safety Policy, Tests & CI | `priority:p0`, `type:security`, `area:safety`, `area:tools`, `phase:mvp` | `docs/07-context-safety-permissions.md`, `docs/05-tool-api.md`, `docs/11-test-plan.md`, `docs/13-risk-register.md` |
| 23 | [#23 Research subprocess backend execution contract against Pi runtime](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/23) | M7 — Subprocess Backend Alpha | `priority:p1`, `type:research`, `area:backend`, `phase:alpha` | `docs/00-source-basis.md`, `docs/06-runtime-backends.md`, `docs/14-release-packaging.md`, `docs/15-ai-coding-agent-prompts.md` |
| 24 | [#24 Implement subprocess ExecutionBackend alpha](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/24) | M7 — Subprocess Backend Alpha | `priority:p1`, `type:feature`, `area:backend`, `phase:alpha` | `docs/06-runtime-backends.md`, `docs/03-architecture.md`, `docs/10-implementation-plan.md`, `docs/11-test-plan.md`, `docs/13-risk-register.md` |
| 25 | [#25 Create dogfood scenario for scout/reviewer/tester/summarizer](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/25) | M8 — Dogfood Alpha | `priority:p1`, `type:test`, `area:tests`, `phase:alpha` | `docs/09-built-in-agents-and-workflows.md`, `docs/11-test-plan.md`, `docs/02-requirements.md` |
| 26 | [#26 Add alpha readiness checklist](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/26) | M8 — Dogfood Alpha | `priority:p2`, `type:docs`, `area:release`, `phase:alpha` | `docs/11-test-plan.md`, `docs/14-release-packaging.md`, `docs/02-requirements.md` |
| 27 | [#27 Prepare npm package metadata and pack validation](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/27) | M9 — Public Beta / npm Release | `priority:p2`, `type:chore`, `area:release`, `phase:beta` | `docs/14-release-packaging.md`, `docs/10-implementation-plan.md`, `docs/11-test-plan.md` |
| 28 | [#28 Create beta release checklist](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/28) | M9 — Public Beta / npm Release | `priority:p2`, `type:docs`, `area:release`, `phase:beta` | `docs/14-release-packaging.md`, `docs/13-risk-register.md`, `docs/11-test-plan.md` |
| 29 | [#29 Add Claude agent definition importer](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/29) | Post-MVP — Compat, Worktree, Workflows & UI | `priority:p3`, `type:feature`, `area:compat`, `phase:post-mvp` | `docs/12-compatibility.md`, `docs/04-agent-definition-spec.md`, `docs/11-test-plan.md`, `docs/ADR.md` |
| 30 | [#30 Add Codex agent definition importer](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/30) | Post-MVP — Compat, Worktree, Workflows & UI | `priority:p3`, `type:feature`, `area:compat`, `phase:post-mvp` | `docs/12-compatibility.md`, `docs/04-agent-definition-spec.md`, `docs/11-test-plan.md`, `docs/ADR.md` |
| 31 | [#31 Design worktree backend](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/31) | Post-MVP — Compat, Worktree, Workflows & UI | `priority:p3`, `type:research`, `area:backend`, `area:safety`, `phase:post-mvp` | `docs/06-runtime-backends.md`, `docs/07-context-safety-permissions.md`, `docs/13-risk-register.md`, `docs/ADR.md` |
| 32 | [#32 Design /agents command and observability UI](https://github.com/vnedyalk0v/pi-subagent-kernel/issues/32) | Post-MVP — Compat, Worktree, Workflows & UI | `priority:p3`, `type:research`, `area:ui`, `phase:post-mvp` | `docs/08-observability-ux.md`, `docs/03-architecture.md`, `docs/10-implementation-plan.md` |
## Manual follow-up steps
1. Open <https://github.com/users/vnedyalk0v/projects/9>.
2. Create the four saved project views listed above.
3. Keep issue #3 open until this tracking file is committed and the project views are confirmed.

No npm publishing or product-code implementation was performed during this setup.
