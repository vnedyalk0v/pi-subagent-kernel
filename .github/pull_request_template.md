## Linked issue
Closes #<issue-number>

## Summary
- <summary>
- <summary>

## Source docs
- `<doc path>`

## Acceptance criteria evidence
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
- [ ] If `ponytail-review` was unavailable, owner approved the documented fallback before PR open

## Codex review loop
- [ ] Initial automatic `codex-connector bot` review completed
- [ ] Addressed, replied to, and resolved all valid `codex-connector bot` findings
- [ ] Requested re-review with `@codex review` after fixes, if findings required changes
- [ ] Latest `codex-connector bot` result after latest commit is `+1`
