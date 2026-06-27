# Codex review reply templates

Use these when replying to `codex-connector bot` review threads. Always adapt them with specific evidence.

## Valid and fixed

```markdown
Addressed in <commit-sha>.

What changed:
- <specific change>

Validation:
- `<command>` passed

Resolving this thread because the finding was valid and has been fixed.
```

## Valid but out of scope

```markdown
This finding is valid, but it is outside the scope of #<issue-number> because <reason>.

Follow-up:
- <created/proposed issue link or title>

No code change in this PR. Resolving this thread because the finding is tracked separately and does not block the linked issue.
```

## Duplicate or outdated

```markdown
This appears to be duplicate/outdated.

Evidence:
- <file/path/commit/test evidence>

No further change needed. Resolving this thread.
```

## Invalid finding

```markdown
I believe this finding is invalid.

Evidence:
- <specific evidence from code/tests/source docs>

No code change made. Resolving this thread because the behavior is correct for the linked issue.
```

## Unsafe suggestion

```markdown
I am not applying this suggestion because it would weaken safety policy or expand permissions.

Safety concern:
- <specific concern>

Requesting owner direction before changing this area. Leaving this thread unresolved until directed.
```
