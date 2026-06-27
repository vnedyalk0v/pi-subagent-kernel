# Contracts and schemas

Read this before implementing or changing contracts, schemas, validation, or public tool result shapes.

## Required contracts

M1 scope includes:

- `AgentDefinition`
- `RunState`
- `RunEnvelope`
- `RunEvent`
- `PermissionPolicy`
- `ExecutionBackend`
- `SpawnInput`
- `RunStatus`
- `ArtifactRef`
- `ToolAllowlist`
- `ModelRoute`

## RunState

Required states:

```ts
export type RunState =
  | "queued"
  | "starting"
  | "running"
  | "waiting_for_input"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";
```

Do not remove states without updating tests and docs.

## RunEnvelope

Every completed/failed/cancelled run result should use a structured envelope or documented subset.

Expected fields include:

- `id`
- `agent`
- `status`
- `summary`
- `findings`
- `artifacts`
- `filesRead`
- `filesChanged`
- `testsRun`
- `cost`
- `confidence`
- `nextActions`
- `error`, when failed

Do not return unstructured free text from public tools unless the issue explicitly allows it.

## AgentDefinition

Pi-native `.pi/agents/*.md` definitions should support Markdown body plus YAML frontmatter.

Expected fields include, where supported by issue scope:

- `name`
- `description`
- `instructions`
- `runtime`
- `tools`
- `skills`
- `model`
- `thinking` or `reasoning`
- `maxTurns`
- `maxRuntimeSec`
- `maxCostUsd`
- `inheritContext`
- `nestedSubagents`
- `sandbox`
- `outputSchema`

Required fields must be validated. Invalid definitions must fail with actionable errors.

## ExecutionBackend

The backend interface must support:

- `spawn(input, context)`
- `status(runId)`
- `result(runId)`
- `cancel(runId)`

Do not implement real subprocess behavior in contract-only issues.

## Validation rules

- Validate public inputs at runtime.
- Reject invalid enum values.
- Reject duplicate agent names in registry/loader scope.
- Keep defaults explicit and test-covered.
- Fail closed for safety-sensitive fields.

## Tests required

Contracts tests must cover:

- missing required fields
- invalid enum values
- invalid runtime
- duplicate names where registry/loader applies
- default safety policy
- `RunEnvelope` required fields
- mock `ExecutionBackend` satisfying interface
