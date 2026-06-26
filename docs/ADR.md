# Architecture Decision Records

## ADR-0001 — Use a kernel plus pluggable backends

Status: Accepted for MVP.

Decision: Build a runtime-neutral SubAgentKernel with SDK and subprocess backends first. Add worktree/mux/remote later.

Rationale: Existing ecosystem packages split between fast in-process sessions and safer subprocess/session isolation. A pluggable backend model avoids choosing one globally.

Consequences:

- More interfaces to design upfront.
- Better long-term safety/performance tradeoffs.
- Easier for workflow packages to reuse the core.

## ADR-0002 — Markdown/YAML is the Pi-native agent format

Status: Accepted.

Decision: Use Markdown files with YAML frontmatter as the primary agent definition format.

Rationale: This matches Claude-style agent definitions and many Pi package conventions. It is human-readable, version-control friendly, and easy to import.

Consequences:

- Codex TOML requires importer.
- YAML parsing and validation must be strict.
- Agent body can stay as natural-language instructions.

## ADR-0003 — Explicit delegation in MVP

Status: Accepted.

Decision: MVP will not proactively delegate unless the parent explicitly calls the subagent tool.

Rationale: Automatic delegation increases surprise, cost, and debugging difficulty. Explicit calls are easier to test and safer for first release.

Consequences:

- Less magical UX at first.
- Better predictability and trust.
- Proactive delegation can be added later as opt-in.

## ADR-0004 — Context summary by default

Status: Accepted.

Decision: Default child context mode is `summary`, not full transcript.

Rationale: Subagents are most useful when noisy work stays out of the main context. Full transcript inheritance increases cost and leakage risk.

Consequences:

- Parent must provide enough task detail.
- Some tasks may need explicit `fork` or `full` context.
- Context builder quality matters.

## ADR-0005 — Deny-by-default tool permissions

Status: Accepted.

Decision: Agent definitions should request explicit tools. Omitted tools do not automatically mean all tools in Pi-native mode.

Rationale: Broad inheritance is convenient but unsafe in a package intended to standardize subagent delegation.

Consequences:

- Imported Claude files need compatibility diagnostics because Claude may treat omitted tools differently.
- Built-in agents must list their tools.
- Fewer accidental writes.

## ADR-0006 — Worktree backend before write-capable implementer defaults

Status: Accepted.

Decision: Write-capable implementation agents should use worktree isolation by default once implemented. Until then, writes require explicit override.

Rationale: Concurrent or autonomous edits in the parent working tree are risky.

Consequences:

- MVP implementer may be limited.
- Worktree implementation becomes a key phase 2 milestone.
- Users get safer review/apply flow.

## ADR-0007 — Structured result envelope for all backends

Status: Accepted.

Decision: All backends must return or be reduced into a common result envelope.

Rationale: UI, workflows, tests, and parent synthesis need stable data.

Consequences:

- Free-text outputs require parsing/reduction.
- Invalid outputs must become structured errors or artifacts.
- More upfront schema work.

## ADR-0008 — Compatibility through importers and aliases

Status: Accepted.

Decision: Preserve compatibility with Claude, Codex, OpenCode, and existing Pi package conventions through adapters, not by making the core schema ambiguous.

Rationale: Compatibility is important, but core safety and clarity matter more.

Consequences:

- Imported definitions may be lossy.
- Diagnostics are required.
- Aliases should be optional until tested.
