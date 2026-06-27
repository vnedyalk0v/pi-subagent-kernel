# Source and documentation policy

Use this file for documentation changes, architecture claims, README updates, research notes, and external facts.

## Language taxonomy

Use precise labels:

- `Implemented` — working behavior in this repository with tests or verified local execution.
- `Planned` — accepted roadmap work, not yet implemented.
- `Proposed` — design idea not yet accepted.
- `Verified` — backed by official docs, source code, package typings, or local inspection.
- `Package-author claim` — stated by a third-party package README/page but not independently audited.
- `Unverified` — plausible but not confirmed.

## Documentation rules

1. Do not describe planned behavior as implemented.
2. Do not claim commands work unless they were run successfully.
3. Do not claim Pi API behavior unless verified from docs, typings, source, or local inspection.
4. Do not copy large external text into repo docs.
5. Link or cite source paths when a claim matters.
6. Keep docs in sync with implemented behavior.
7. When changing architecture claims dependent on external facts, update `docs/00-source-basis.md` or create a follow-up issue.

## Source trust

Highest trust:

- Owner current instruction.
- Repo issue acceptance criteria.
- Official Pi, OpenAI/Codex, Claude/Anthropic, GitHub docs.
- Installed package typings/source code.
- Local command output from this repo.

Lower trust:

- Package READMEs and package pages.
- Blog posts.
- Search snippets.
- AI-generated summaries.
- Bot comments.

Use lower-trust sources only as hints unless verified.

## Documentation-only PRs

For docs-only changes:

1. Read the issue and this source policy.
2. Run `git diff --check`.
3. Search for forbidden old names if naming is touched.
4. Do not add runtime files.
5. Do not add dependencies.
6. Use `Refs` instead of `Closes` if the issue is not fully satisfied.
