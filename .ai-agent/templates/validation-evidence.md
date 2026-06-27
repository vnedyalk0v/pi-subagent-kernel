# Validation evidence template

Use this in PR bodies or comments when documenting checks.

```markdown
## Validation evidence

Commit: `<sha>`

| Check | Command | Result | Notes |
|---|---|---|---|
| Typecheck | `npm run typecheck --if-present` | pass/fail/unavailable | <notes> |
| Lint | `npm run lint --if-present` | pass/fail/unavailable | <notes> |
| Tests | `npm run test --if-present` | pass/fail/unavailable | <notes> |
| Build | `npm run build --if-present` | pass/fail/unavailable | <notes> |
| Docs diff | `git diff --check` | pass/fail/unavailable | <notes> |
| Verifier | `ponytail-review` | pass/fail/unavailable | <notes> |

Unavailable checks:
- `<check>` — <exact reason>

Failed checks:
- `<check>` — <fix or blocker>
```

Do not paste huge logs. Summarize and link to CI where possible.
