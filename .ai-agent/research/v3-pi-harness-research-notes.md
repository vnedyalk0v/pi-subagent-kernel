# V3 research notes — Pi harness support

Verified on 2026-06-27 during the v3 instruction bundle update.

## Pi Coding Agent

Sources checked:

- Pi Quickstart: `https://pi.dev/docs/latest/quickstart`
- Pi Using Pi: `https://pi.dev/docs/latest/usage`
- Pi Skills: `https://pi.dev/docs/latest/skills`
- Pi Extensions: `https://pi.dev/docs/latest/extensions`
- Pi Settings: `https://pi.dev/docs/latest/settings`
- Pi RPC: `https://pi.dev/docs/latest/rpc`
- Pi Compaction & Branch Summarization: `https://pi.dev/docs/latest/compaction`

Findings to encode in instructions:

1. Pi loads context files at startup, including global `~/.pi/agent/AGENTS.md` and `AGENTS.md` or `CLAUDE.md` from parent/current directories. It requires restart or `/reload` after changing context files.
2. Pi default tools include `read`, `write`, `edit`, and `bash`; read-only tools such as `grep`, `find`, and `ls` can also be available through tool options.
3. Pi runs in the current working directory and can modify files. The repo workflow must therefore continue to require branches, issue scope, validation, PR review, and no direct `main` work.
4. Pi skills are self-contained on-demand capability packages. Pi scans skill locations and includes names/descriptions; full skill instructions are loaded when the model uses the skill or the user forces it with `/skill:name`.
5. Pi loads skills from global and project locations, including `.agents/skills/` in the current working directory and ancestors after project trust. This means the existing `.agents/skills/*/SKILL.md` adapters can serve Pi as well as Codex-style skill discovery.
6. Project settings can load packages, extensions, skills, prompts, and themes. Committing or modifying `.pi/settings.json` should be treated as harness behavior change, not casual cleanup.
7. Pi extensions can register tools, commands, lifecycle/event handlers, UI, shortcuts, and providers. Implementation must verify APIs from docs/typings/source before use.
8. Pi RPC supports steering/follow-up/abort patterns. These mechanisms must not bypass workflow gates.
9. Pi compaction can summarize older context, so durable workflow state must be in GitHub issues/PRs/docs, not only in conversation memory.

## Design decisions

1. Do not duplicate `.agents/skills` into `.pi/skills`, because Pi already discovers `.agents/skills/` and duplicate skills could confuse routing.
2. Do not add active `.pi/settings.json` in this bundle. Include only `.pi/settings.example.json` as documentation; active settings changes require owner approval.
3. Add a Pi-specific harness adapter under `.ai-agent/harness/pi-coding-agent.md`.
4. Add Pi-oriented skill adapters under `.agents/skills/` only when they remain thin and route to canonical `.ai-agent` files.
5. Keep root `AGENTS.md` as the cross-harness authority.

## Non-claims

This bundle does not claim that Pi automatically loads every `.ai-agent/` file. It does not claim that Pi always loads full skills without prompting. It does not claim that all Pi versions behave identically. If local installed behavior differs, local verified behavior wins and this file should be updated in a dedicated instruction-change PR.
