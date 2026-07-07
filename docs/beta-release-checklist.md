# Public beta release checklist

Use this before declaring a public beta ready or publishing any npm package. Checked means evidence is captured in the release PR, release issue, or linked CI run. Do not publish from this checklist alone; `npm publish`, tags, and GitHub releases still require explicit owner approval in the current task.

## Public beta gates

| Status | Gate | Required evidence | Tracking |
|---|---|---|---|
| [ ] | Owner release approval | Owner explicitly approves the beta release action, package name, version, license state, and whether `private` may be removed. | Release issue |
| [ ] | Security review | No secrets in repo/package artifacts, deny-by-default safety defaults still covered, dependency gate complete for any dependency or lockfile changes, and install security warning remains documented. | Release PR |
| [ ] | Documentation check | README and docs distinguish implemented behavior from known limitations, include install/use instructions, and do not claim live model/provider or production readiness without evidence. | Release PR |
| [ ] | CI pass | `npm run typecheck --if-present`, `npm run lint --if-present`, `npm run test --if-present`, and `npm run build --if-present` pass on the beta candidate commit. | Release PR or CI run |
| [ ] | Clean install | `npm pack` tarball contents are inspected, installed in a fresh temp package, and `import('pi-subagent-kernel')` exposes `activate`. | #27 or release PR |
| [ ] | Example agent load | A clean-install smoke loads a trusted `.pi/agents/*.md` fixture or repo `examples/agents/scout.md` through the exported loader and records the loaded agent name. | Release PR |
| [ ] | Pi extension smoke | Local Pi development load registers `subagent_spawn`, `subagent_status`, `subagent_result`, and `subagent_cancel`; any mocked-only behavior is stated as such. | Release PR |
| [ ] | Rollback plan | Release notes include the rollback plan below, including how to supersede or deprecate a bad beta without deleting history. | Release notes |
| [ ] | Known limitations | Known beta limitations below are copied or updated in README/release notes before any release claim. | Release notes |

Unchecked beta gates must link to a follow-up issue or an explicit owner waiver before publishing.

## Clean install evidence shape

Use a temporary directory, not the working tree. Record Node/npm versions when relevant.

```bash
npm ci
npm run build
npm pack
sample_dir=$(mktemp -d)
cd "$sample_dir"
npm init -y
npm install /path/to/pi-subagent-kernel-0.1.0-beta.0.tgz
node --input-type=module --eval "import('pi-subagent-kernel').then((m) => { if (typeof m.activate !== 'function') throw new Error('missing activate'); })"
```

For the example agent-load gate, also record the exact fixture path and command used to load at least one Markdown agent definition through the installed package.

## Known beta limitations to review

- No npm package has been published until an owner-approved release task performs it.
- The package is currently marked `private: true` and `UNLICENSED` until the owner approves publishing and chooses a license path.
- Current local smoke evidence covers Pi extension loading and mock tool behavior, not a live provider/model subagent run.
- `SubprocessExecutionBackend` has fixture-tested process behavior; live model-result extraction and active model-call cancellation are not production-readiness claims yet.
- `/agents` UI/command work is post-MVP and tracked separately in #32.
- Worktree backend, workflow/DAG orchestration, remote workers, cost accounting, and compatibility importers remain out of beta scope unless a later issue explicitly adds them.

## Rollback plan

If a beta release is bad:

1. Stop promoting the version in README, release notes, and issue comments.
2. Leave git history and published artifacts intact unless the owner instructs otherwise.
3. Prefer publishing a fixed prerelease version, such as `0.1.0-beta.1`, after the normal checklist passes again.
4. If the package is already on npm and should not be used, deprecate the bad version with an owner-approved message instead of relying on unpublish.
5. Open or update a tracking issue with impact, affected versions, mitigation, and validation evidence for the replacement.

## Release notes template

```markdown
# pi-subagent-kernel <version>

## Release type
Public beta / internal beta / dry run

## Implemented behavior
- <implemented, evidence-backed behavior>

## Validation evidence
- Commit: <sha>
- CI: <link or unavailable reason>
- Local checks: <commands and pass/fail>
- Pack/install smoke: <tarball name and result>
- Pi smoke: <command and result>
- Example agent load: <fixture and result>

## Security notes
- <safety defaults and review outcome>
- <dependency or package-artifact review outcome>

## Known limitations
- <limitation 1>
- <limitation 2>

## Breaking changes
- None / <details>

## Upgrade or install notes
- <install command or local tarball path>

## Rollback
- <deprecate/supersede plan and tracking issue>
```
