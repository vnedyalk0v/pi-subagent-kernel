# Dependency gate report template

```markdown
## Dependency gate

Dependency change: <none / added / removed / upgraded>

| Package | Change | Scope | Reason |
|---|---|---|---|
| `<name>` | `<from → to>` | runtime/dev | <why needed> |

## Justification

- Why built-in Node/TypeScript is insufficient:
- Issue/owner approval:
- License observed:
- Install scripts/native binaries:
- Lockfile impact:
- Known advisory/tooling result:

## Validation

- [ ] `npm run typecheck --if-present`
- [ ] `npm run lint --if-present`
- [ ] `npm run test --if-present`
- [ ] `npm run build --if-present`
- [ ] Dependency review/check result, if available:

## Risk decision

<Accept / reject / ask owner / follow-up>
```
