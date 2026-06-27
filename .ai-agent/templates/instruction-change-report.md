# Instruction-change report template

```markdown
## Instruction change report

## Files changed

- `<path>` — <reason>

## Hard rules preserved

- [ ] Issue/PR assignment to `vnedyalk0v`
- [ ] No direct work on `main`
- [ ] Issue order and scope rules
- [ ] Pre-PR `ponytail-review` gate
- [ ] Codex review loop and current-head `+1`
- [ ] No AI merge without explicit owner instruction
- [ ] No npm publish without explicit owner instruction and release gate
- [ ] Safety defaults remain deny-by-default
- [ ] Secrets/privacy/chain-of-thought rules preserved
- [ ] `.ai-agent/` files are routed, not bulk-loaded by default

## Rules added

- <rule>

## Rules moved

- <from> → <to>

## Rules removed

- <rule or `none`>
- Why this does not make the workflow looser:

## Routing audit

- Audit run: yes/no
- Result: PASS / PASS WITH MINOR FIXES / FAIL
- Deviations:

## Token impact

- Root `AGENTS.md` size changed from <old> to <new>.
- Files now loaded less often:
- Files now loaded more often:
```


## Pi compatibility

- [ ] Read `.ai-agent/harness/pi-coding-agent.md` if Pi behavior may be affected.
- [ ] Confirmed the change does not require `.ai-agent/` auto-loading.
- [ ] Confirmed `.agents/skills/*/SKILL.md` adapters remain thin.
- [ ] Confirmed no active `.pi/settings.json` change was introduced without owner approval.
- [ ] Added `/reload` or restart note if context files changed.
