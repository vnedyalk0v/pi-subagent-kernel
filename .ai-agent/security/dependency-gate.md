# Dependency gate

Use this file whenever a task adds, removes, upgrades, or configures dependencies, package metadata, lockfiles, install scripts, package managers, or third-party runtime tools.

## Default stance

Do not add production dependencies unless:

1. The issue explicitly requires it, or
2. The owner explicitly approves it in the current task, or
3. The dependency is already present and the change is a narrow version/config maintenance task.

Prefer built-in Node.js/TypeScript functionality and small local utilities when reasonable.

## Required checks before changing dependencies

Document:

- Dependency name and version/range.
- Runtime vs dev dependency.
- Why built-in functionality is insufficient.
- Whether it introduces postinstall scripts or native binaries.
- License, if easily available from package metadata.
- Whether it touches transitive dependency count significantly.
- Whether lockfile changes are expected.
- Whether security advisories are known from available tooling.
- Whether it affects package publishing or consumers.

## Required validation

Run what exists:

```bash
npm run typecheck --if-present
npm run lint --if-present
npm run test --if-present
npm run build --if-present
```

If available, also run dependency/security checks. Do not invent commands. If GitHub dependency review is configured, note that the PR must wait for it.

## Lockfile policy

1. Do not hand-edit lockfiles unless repairing a documented package-manager issue.
2. Review lockfile diff at a high level.
3. Explain large lockfile changes.
4. Do not hide lockfile changes in unrelated PRs.

## Forbidden without owner approval

- New production dependencies.
- Packages with install scripts requiring network or credentials.
- Dependency changes in docs-only PRs.
- Switching package managers.
- Adding package mirrors or registries.
- Adding MCP servers, plugins, extensions, or postinstall tooling.

## PR body requirement

Use `.ai-agent/templates/dependency-gate-report.md` for dependency changes.
