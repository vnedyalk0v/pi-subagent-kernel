# Pull request body template

Use this template for every PR. Delete sections only when clearly not applicable and explain why.

```markdown
## Linked issue
Closes #<issue-number>

## Summary
- <short bullet 1>
- <short bullet 2>

## Instruction packs read
- `.ai-agent/...`
- `.ai-agent/...`

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
- [ ] `git diff --check`
- [ ] Other: <command or reason not run>

## Validation evidence
Commit: `<sha>`

| Check | Result | Notes |
|---|---|---|
| Typecheck | pass/fail/unavailable | <notes> |
| Lint | pass/fail/unavailable | <notes> |
| Tests | pass/fail/unavailable | <notes> |
| Build | pass/fail/unavailable | <notes> |
| Verifier | pass/fail/unavailable | <notes> |

## Safety and scope check
- [ ] No unrelated changes
- [ ] No secret, token, or API key exposure
- [ ] No hidden chain-of-thought or private scratchpad content
- [ ] No unverified Pi API claims
- [ ] No safety-default regression
- [ ] No dependency or lockfile change, or dependency gate completed
- [ ] No npm publishing

## Pre-PR verifier gate
- [ ] Ran a fresh verifier subagent with `ponytail-review` against the final diff before opening the PR
- [ ] Fixed or documented every valid verifier finding
- [ ] If `ponytail-review` was unavailable, owner approved the documented fallback before PR open

## Codex review loop
- [ ] Automatic `codex-connector bot` review completed for the latest commit
- [ ] Addressed, replied to, and resolved all valid `codex-connector bot` findings
- [ ] Did not manually request review unless owner explicitly directed or auto-review was confirmed unavailable
- [ ] Latest `codex-connector bot` result after latest commit is `+1`

## Risk
Low / Medium / High

## Notes for owner
<none or concise notes>
```
