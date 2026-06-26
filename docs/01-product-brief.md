# Product Brief

## Product name

Working name: **Pi SubAgents Next**.

Package name candidates:

- `@pi-subagents/extension`
- `pi-subagents-next`
- `@your-scope/pi-subagents-next`

Use a scoped package if publishing externally. Use an unscoped package only if the npm name is intentionally owned and maintained.

## Problem

Pi intentionally keeps its core minimal and relies on extensions/packages for higher-level workflows. That has produced a large subagent ecosystem, but the ecosystem is fragmented:

- Different packages expose different tool names and schemas.
- Some are in-process and fast; others are subprocess-based and safer.
- Some support background agents, steering, or resume; others do not.
- Some use Markdown/YAML agent definitions; others use custom config.
- Safety and permission models vary significantly.
- Observability is inconsistent.
- Workflow packages and simple delegation packages do not share a common runtime contract.

The result is useful experimentation but no single stable SubAgents layer that can serve as a foundation for other Pi extensions.

## Product goal

Build a Pi-native SubAgents layer that standardizes agent delegation while staying small enough to trust and maintain.

The product should feel like:

- Codex-style explicit parallel agents.
- Claude-style isolated contexts and specialized agents.
- Pi-native tools, commands, events, UI, package install, and configuration.

## Value proposition

> A safer, clearer, more extensible subagent kernel for Pi: durable runs, structured results, pluggable execution backends, tight permissions, and compatibility with existing agent definition styles.

## Target users

1. **Solo developers** who want reliable scout/review/test/implement subagents without installing many conflicting packages.
2. **Teams** who want repeatable agent definitions and safe project-local subagents.
3. **Extension authors** who want to build workflows on top of a stable subagent service API.
4. **Power users** who want background agents, status views, steering, worktrees, and cost accounting.

## MVP user stories

### Delegate read-only exploration

As a developer, I want to ask a `scout` subagent to inspect part of a repo and return concise findings, so that the main conversation does not fill with search output.

Acceptance:

- The scout receives a task, working directory, allowed file paths/globs, and read-only tools.
- The parent receives a structured result with summary, files read, findings, and confidence.
- The child transcript is not pasted into the parent context.

### Run independent review

As a developer, I want a `reviewer` subagent to check my current diff for correctness and risk, so that implementation and review are separated.

Acceptance:

- Reviewer cannot write files by default.
- Reviewer returns actionable findings, not style noise.
- Findings include file/path/line when available.

### Run background task

As a developer, I want to start a subagent in the background and continue working, so that long-running research does not block me.

Acceptance:

- Spawn returns a run ID.
- `/agents` shows status.
- Result can be retrieved later.
- The run can be cancelled.

### Safe implementation branch

As a developer, I want an `implementer` subagent to make changes in a git worktree, so that concurrent edits do not corrupt my current working tree.

Acceptance:

- Implementation agents use worktree mode unless explicitly overridden.
- The result includes changed files and patch location.
- Parent must merge/apply changes explicitly.

## Non-goals for MVP

- No autonomous project-wide refactoring without user-scoped tasks.
- No unlimited recursive delegation.
- No remote/cloud worker execution.
- No automatic installation of MCP servers or package dependencies from agent files.
- No full workflow/DAG engine before one-off subagent runs are reliable.
- No claim to be a security sandbox against malicious local code. This is a permission and process isolation layer, not a hardened container runtime.

## Success metrics

Track these locally; do not block MVP on external telemetry.

- Median time to spawn SDK read-only agent.
- Subprocess start failure rate.
- Number of unresolved background runs after session shutdown.
- Percentage of runs with valid structured result envelopes.
- Percentage of reviewer findings that include actionable evidence.
- Number of tool-permission denials by policy.
- Cost/token usage per run where provider metadata is available.

## Product principles

1. Explicit over magical.
2. Isolated by default.
3. Structured results over free-text blobs.
4. Safe fallbacks over partial hidden execution.
5. Small API surface, rich details object.
6. Compatibility through adapters, not by copying every upstream behavior.
7. Observability without context pollution.
