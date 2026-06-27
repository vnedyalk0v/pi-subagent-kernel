# V2 instruction architecture research notes

Date: 2026-06-27

These notes record why the v2 bundle uses a short root `AGENTS.md` plus routed `.ai-agent/` packs.

## Verified assumptions

1. Codex reads `AGENTS.md` before doing work and supports repository-level/project guidance.
   Source: OpenAI Developers — Custom instructions with AGENTS.md.

2. Codex `AGENTS.md` guidance has a project instruction size budget, so a shorter always-on router helps avoid carrying full workflow detail into every task.
   Source: OpenAI Developers — Custom instructions with AGENTS.md.

3. Codex GitHub review can be requested with `@codex review`, can be configured for automatic reviews, follows repository guidance, and focuses on serious P0/P1 issues.
   Source: OpenAI Developers — Codex code review in GitHub.

4. Codex Skills use progressive disclosure: a skill is a directory with `SKILL.md`; Codex initially sees name/description/path and reads full instructions only when a skill is selected.
   Source: OpenAI Developers — Agent Skills.

5. Claude Code loads `CLAUDE.md` memory files into context; imported files are organizationally useful but should not be used here to eagerly import all `.ai-agent/` packs if the goal is token saving.
   Source: Claude Code memory docs.

6. GitHub Copilot custom instructions use `.github/copilot-instructions.md` and `.github/instructions/**/*.instructions.md` for repository and path-specific instructions; multiple instruction sets may apply.
   Source: GitHub Copilot custom instructions docs.

7. GitHub branch protection can require successful/skipped/neutral status checks before merge, and CODEOWNERS can be tied to required owner review.
   Source: GitHub protected branches and CODEOWNERS docs.

8. GitHub dependency review helps reviewers understand dependency changes and known vulnerabilities in PRs.
   Source: GitHub dependency review docs.

9. GitHub push protection is designed to block hardcoded secrets before they reach the repository.
   Source: GitHub push protection docs.

10. OWASP classifies prompt injection as a top LLM risk where prompts alter model behavior unexpectedly, including through imperceptible parsed content.
    Source: OWASP LLM01:2025 Prompt Injection.

## Design decisions

- Keep root `AGENTS.md` strict and short enough to be always-on.
- Do not import every routed file from `CLAUDE.md`.
- Use `.ai-agent/routing-manifest.json` as structured routing source.
- Add routing audit and expected routing files to prevent future loosening.
- Add untrusted-input, dependency, release, and repository-control gates because AI coding agents interact with external text, packages, and GitHub automation.
- Add thin Codex Skill adapters, but do not make them the canonical source of truth.

## Non-claims

- `.ai-agent/*.md` files are not assumed to auto-load in all agents.
- `.agents/skills/**` adapters are optional and only useful where the agent/runtime supports skills.
- GitHub repository settings are not assumed to be enabled merely because runbooks mention them.
- Codex automatic review is a repository configuration expectation; agents must verify current PR review state rather than assume a review happened.
