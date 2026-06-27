# Release and npm guardrails

Use this file for release, versioning, `npm pack`, `npm publish`, package metadata, tags, GitHub releases, and public beta work.

## Hard rule

`npm publish` is forbidden unless all of these are true:

1. The owner explicitly asks for publishing in the current task.
2. The work is in `M9 — Public Beta / npm Release` or a later release milestone.
3. CI is green or unavailable checks are explicitly accepted by the owner.
4. Latest `codex-connector bot` result after latest commit is `+1`.
5. Package metadata has been reviewed.
6. `npm pack` has been run and the tarball contents inspected.
7. A clean install test has been completed.
8. Known limitations are documented.

## Allowed before publish

In M9 or owner-approved release prep, you may:

- Review package metadata.
- Run `npm pack`.
- Inspect tarball contents.
- Test install in a clean temporary repo.
- Draft release notes.
- Create a release checklist.

Do not create public tags, GitHub releases, or npm publications without explicit owner instruction.

## Package metadata checklist

Verify:

- `name` is `pi-subagent-kernel` or the owner-approved scoped name.
- `description` is accurate and not overclaiming implemented behavior.
- `repository` points to `vnedyalk0v/pi-subagent-kernel`.
- `license` matches repo license.
- `files` / `.npmignore` excludes tests, secrets, scratch files, local configs, and artifacts.
- `exports` and `types` point to built files.
- README install/use instructions are verified.

## Clean install checklist

Use a temporary directory. Do not reuse the working tree.

Document:

- Node/npm versions if relevant.
- Pack command.
- Tarball name.
- Install command.
- Smoke test.
- Result.

## Release notes

Release notes must distinguish:

- Implemented behavior.
- Known limitations.
- Breaking changes.
- Security notes.
- Upgrade steps, if any.
