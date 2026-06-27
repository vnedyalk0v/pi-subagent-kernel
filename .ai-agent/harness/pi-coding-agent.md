# Pi Coding Agent harness adapter

Use this when the current agent is running in Pi Coding Agent or when the task involves Pi context files, Pi skills, Pi extensions, Pi commands, Pi RPC/steering, or Pi-specific execution behavior.

## Verified Pi behavior to account for

1. Pi loads project instructions from `AGENTS.md` or `CLAUDE.md` in parent/current directories and global instructions from `~/.pi/agent/AGENTS.md`.
2. After changing context files, restart Pi or run `/reload` before expecting the new instructions to affect a session.
3. Pi shows loaded context files, prompt templates, skills, and extensions in the startup header.
4. Pi default tools include `read`, `write`, `edit`, and `bash`; additional read-only tools include `grep`, `find`, and `ls` through tool options.
5. Pi runs in the current working directory and can modify files there. Use git branch/checkpoint discipline exactly as required by root `AGENTS.md`.
6. Pi skills are on-demand capability packages. At startup, Pi scans skill locations and exposes skill names/descriptions; the full `SKILL.md` is loaded when the task matches or when forced with `/skill:name`.
7. Project skills are loaded only after the project is trusted. If a required project skill is not visible or usable, stop and ask the owner instead of silently substituting a different review.
8. Pi discovers project `.agents/skills/` directories, so the shared `.agents/skills/*/SKILL.md` adapters in this repo are intended to work for Pi and Codex-style skill discovery. Do not duplicate them into `.pi/skills/` unless an issue explicitly requires it.
9. Pi settings can load packages, extensions, skills, prompts, and themes from `.pi/settings.json`, but do not add or change project settings automatically unless the issue requires it or the owner approves it.
10. Pi extensions can register tools, commands, events, UI, shortcuts, flags, and providers. Do not invent extension APIs; verify against installed typings or official docs before implementing.
11. Pi RPC supports `steer`, `follow_up`, and `abort`; skill commands and prompt templates expand during these message flows. Do not use RPC steering to bypass PR/review gates or owner approval.
12. Pi compaction may summarize older context. Do not rely on old conversation details being fully available after compaction; keep durable state in issues, PR bodies, docs, and committed files.

## Pi-specific operating rules

1. Use root `AGENTS.md` as the authority router. Do not bulk-read all `.ai-agent/` files.
2. For implementation work in Pi, read this file plus the routed implementation/safety/test files.
3. For PR creation in Pi, use the shared `.agents/skills/open-pr` skill only if it is available; otherwise read `.ai-agent/workflows/branch-commit-pr.md` and `.ai-agent/workflows/pre-pr-verifier.md` directly.
4. For pre-PR review, `ponytail-review` is mandatory. If `/ponytail-review` or the corresponding skill is unavailable, stop before opening the PR and ask the owner to enable it or approve a one-time documented fallback.
5. For validation commands whose output must support a PR claim, do not run them with hidden shell output that the model cannot see. Capture enough output to honestly state pass/fail without committing verbose logs.
6. If a shell command may expose secrets, do not run it unless the issue requires it and the output handling is safe.
7. When context/instruction files change, mention that Pi sessions need `/reload` or restart before those changes are active.
8. Do not assume Pi skills always load the full instructions automatically. If a task requires a skill, explicitly invoke it or read the routed instruction file.
9. Do not add `.pi/settings.json` or project package settings as a convenience. Settings changes can alter harness behavior and must be treated as repo-control/instruction-change work.
10. If Pi’s actual installed version behaves differently from these notes, prefer verified local behavior, document it, and update `.ai-agent/research/v3-pi-harness-research-notes.md` in a dedicated instruction-change PR.

## Pi-specific stop conditions

Stop and ask the owner when:

1. Required skills are not discovered or project trust blocks them.
2. `/reload` is needed but cannot be run or verified.
3. A required Pi extension/API behavior is not verified.
4. A project settings change would be needed.
5. A Pi RPC/steering operation would change task scope mid-run.
6. A validation command cannot be observed well enough to support PR claims.
7. Compaction/context loss makes the issue, PR state, or owner instruction uncertain.

## Minimal Pi task routing examples

- Issue #4 implementation in Pi: read this file, `.ai-agent/implementation/engineering-principles.md`, `.ai-agent/implementation/mvp-order-and-scope.md`, `.ai-agent/implementation/source-layout.md`, `.ai-agent/implementation/contracts-and-schemas.md`, and `.ai-agent/implementation/testing-and-validation.md`.
- Opening a PR in Pi: read this file, `.ai-agent/workflows/branch-commit-pr.md`, `.ai-agent/workflows/pre-pr-verifier.md`, `.ai-agent/templates/pr-body.md`, and `.ai-agent/templates/validation-evidence.md`.
- Handling Codex bot comments while using Pi: read this file only if shell/GitHub command behavior matters, then `.ai-agent/workflows/codex-review-loop.md`, `.ai-agent/review/codex-severity-taxonomy.md`, and `.ai-agent/templates/codex-review-replies.md`.
