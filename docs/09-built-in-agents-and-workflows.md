# Built-in Agents and Workflows

Built-in agents should be narrow, opinionated, and safe. They are examples and defaults, not a replacement for project-specific agents.

## Built-in agent set

Implemented MVP-safe built-ins:

```text
scout
reviewer
tester
summarizer
```

MVP design candidates deferred from the package defaults until a scoped issue needs them:

```text
planner
implementer
```

`implementer` must stay out of built-ins until write-capable subprocess/worktree safety exists.

Phase 2 agents:

```text
security-auditor
docs-researcher
migration-planner
performance-reviewer
release-notes-writer
```

## Agent specs

### `scout`

Purpose: read-only codebase reconnaissance.

Default policy:

```yaml
runtime: sdk
tools: [read, grep, find, ls]
filesystem: read-only
network: none
context: summary
outputSchema: research_notes_v1
```

Good tasks:

- Find all call sites of a function.
- Map auth flow entry points.
- Identify files likely affected by a feature.

Bad tasks:

- Make edits.
- Run broad destructive commands.
- Decide final architecture alone.

### `planner`

Purpose: turn evidence into an implementation plan.

Default policy:

```yaml
runtime: sdk
tools: [read, grep, find, ls]
filesystem: read-only
network: none
context: summary
outputSchema: plan_v1
```

Planner should produce:

- Scope.
- Assumptions.
- Files likely affected.
- Step-by-step plan.
- Test strategy.
- Risks.

Planner must not edit files.

### `reviewer`

Purpose: independent correctness/security/test-risk review.

Default policy:

```yaml
runtime: subprocess
tools: [read, grep, find, ls, bash:test-only]
filesystem: read-only
network: none
context: summary
outputSchema: review_findings_v1
```

Reviewer should prioritize:

- Real bugs.
- Security issues.
- Data loss.
- Race conditions.
- Regression risks.
- Missing tests for changed behavior.

Reviewer should avoid:

- Style-only comments.
- Rewriting implementation.
- Broad refactors.

### `tester`

Purpose: identify and run focused validation.

Default policy:

```yaml
runtime: subprocess
tools: [read, grep, find, ls, bash:test-only]
filesystem: read-only
network: none
context: summary
outputSchema: test_report_v1
```

Tester should return:

- Commands run.
- Pass/fail status.
- Relevant failures.
- Minimal reproduction if available.
- Suggested next test.

### `implementer`

Purpose: make a small scoped change after evidence exists.

MVP policy:

```yaml
runtime: subprocess
filesystem: read-only by default
writesRequireExplicitOverride: true
```

Phase 2 policy:

```yaml
runtime: worktree
tools: [read, grep, find, ls, bash, edit, write]
filesystem: worktree-write
network: ask
context: summary
outputSchema: implementation_patch_v1
```

Implementer should:

- Make the smallest defensible change.
- Keep unrelated files untouched.
- Run focused validation.
- Return a patch/diff artifact.

Implementer should not:

- Auto-merge to parent branch.
- Install packages without approval.
- Run broad formatters unless scoped.

### `summarizer`

Purpose: reduce child results into one concise answer.

Default policy:

```yaml
runtime: sdk
tools: []
filesystem: none
network: none
context: none
outputSchema: summary_v1
```

Summarizer should:

- Deduplicate findings.
- Preserve severity.
- Identify disagreements.
- Produce final next actions.

## Output schemas

### `review_findings_v1`

```json
{
  "summary": "string",
  "findings": [
    {
      "severity": "low|medium|high|critical",
      "title": "string",
      "file": "string|null",
      "line": "number|null",
      "evidence": "string",
      "recommendation": "string"
    }
  ],
  "confidence": "number"
}
```

### `test_report_v1`

```json
{
  "summary": "string",
  "commands": [
    {
      "command": "string",
      "status": "passed|failed|skipped|unknown",
      "durationMs": "number|null",
      "relevantOutput": "string"
    }
  ],
  "failingTests": [],
  "nextTests": [],
  "confidence": "number"
}
```

### `implementation_patch_v1`

```json
{
  "summary": "string",
  "filesChanged": ["string"],
  "patchArtifact": "string|null",
  "testsRun": [],
  "risks": [],
  "nextActions": []
}
```

## Recommended workflows

### Review current diff

```text
1. scout maps changed areas.
2. reviewer inspects correctness/security/test risk.
3. tester identifies focused validation.
4. summarizer deduplicates final result.
```

### Implement small feature

```text
1. scout finds relevant files.
2. planner creates scoped plan.
3. implementer works in worktree.
4. tester validates.
5. reviewer checks diff.
6. summarizer returns merge recommendation.
```

### Deep codebase research

```text
1. Parent splits independent modules.
2. Multiple scouts run in parallel.
3. docs-researcher verifies external APIs when needed.
4. summarizer combines evidence.
```

### Security audit slice

```text
1. scout maps data/input boundaries.
2. security-auditor reviews a bounded surface.
3. reviewer checks exploitability and false positives.
4. summarizer returns only actionable issues.
```

## Workflow constraints

- Do not run implementation before scout/planner when the task is ambiguous.
- Do not run many agents when one focused agent is enough.
- Do not call reviewer and implementer in the same child context.
- Do not let reviewer edit files.
- Do not let summarizer fabricate evidence not present in child results.
