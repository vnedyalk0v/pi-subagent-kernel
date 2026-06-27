# Instruction discovery research notes

Last verified: 2026-06-27.

This file documents why this repository uses a short root `AGENTS.md` plus routed `.ai-agent/` instruction packs.

## Verified findings

### AGENTS.md is the portable baseline

The AGENTS.md project describes `AGENTS.md` as a simple Markdown format, a “README for agents”, intended to keep agent-specific instructions separate from human-facing README content. It recommends covering setup, tests, code style, testing, security, and PR instructions. It also notes that nested AGENTS.md files can tailor instructions for subprojects.

Source: https://agents.md/

### Codex automatic discovery is AGENTS-based, not arbitrary-directory based

Codex reads `AGENTS.md` files before work. It layers global and project-scope files, walks from project root to current working directory, and includes at most one recognized instruction file per directory. Recognized project files are `AGENTS.override.md`, `AGENTS.md`, and configured fallback filenames. Codex stops adding files when the combined project instruction limit is reached; the documented default is 32 KiB.

Source: https://developers.openai.com/codex/guides/agents-md
Source: https://developers.openai.com/codex/config-advanced

Implication for this repo: `.ai-agent/*.md` files are not automatically loaded by Codex merely because they exist. They save context only when the root `AGENTS.md` routes the agent to read them on demand.

### Codex recommends keeping AGENTS guidance small

OpenAI's Codex customization docs say `AGENTS.md` gives persistent project guidance and should be kept small. It is suited for always-on rules such as build/test commands, review expectations, repo-specific conventions, and directory-specific instructions.

Source: https://developers.openai.com/codex/concepts/customization

Implication for this repo: root `AGENTS.md` should contain only mandatory, always-on rules and routing. Detailed workflows belong in routed files or skills.

### Codex Skills use progressive disclosure

Codex Skills load only the skill metadata initially and load the full `SKILL.md` only when the skill is used. OpenAI describes this as progressive disclosure to manage context efficiently.

Source: https://developers.openai.com/codex/skills

Implication for this repo: long repeatable workflows such as PR review loops can later be converted to skills, but this zip keeps the requested `.ai-agent/` routed Markdown structure as the portable baseline.

### Codex GitHub review follows AGENTS.md review guidance

OpenAI's Codex GitHub review docs say Codex code review can be requested with `@codex review`, automatic reviews can be enabled, and Codex searches the repository for `AGENTS.md` files and follows Review guidelines. The docs state Codex flags only P0/P1 issues in GitHub reviews to keep comments focused.

Source: https://developers.openai.com/codex/integrations/github

Implication for this repo: review-specific rules must remain visible from root `AGENTS.md` or be explicitly routed before review work.

### Claude Code: imports do not save startup context

Claude Code reads `CLAUDE.md`, not `AGENTS.md`, so a `CLAUDE.md` adapter should import or point to `AGENTS.md`. However, Claude's `@path` imports are expanded and loaded into context at launch. Anthropic explicitly notes that splitting content into imports helps organization but does not reduce context, because imported files still load at launch. Claude also recommends keeping CLAUDE.md under about 200 lines and using path-scoped rules or skills when content is large.

Source: https://code.claude.com/docs/en/memory

Implication for this repo: `CLAUDE.md` imports only root `AGENTS.md`. Do not import every `.ai-agent/` file from `CLAUDE.md`; that would defeat the token-saving goal.

### Claude Code Skills load only when used

Claude Code docs say a skill's body loads only when the skill is used, so long reference material costs little until needed.

Source: https://code.claude.com/docs/en/skills

Implication for this repo: if a routed `.ai-agent/` workflow becomes a repeated command, converting it into a skill may be better than always-on instructions.

### GitHub Copilot has different custom-instruction support depending on product surface

GitHub docs list support differences. Copilot cloud agent supports repository-wide instructions, path-specific instructions, and agent instructions such as `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md`. Copilot code review on GitHub supports repository-wide `.github/copilot-instructions.md` and path-specific `.github/instructions/**/*.instructions.md`; it does not list `AGENTS.md` for GitHub.com code review in the support matrix.

Source: https://docs.github.com/en/copilot/reference/custom-instructions-support
Source: https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions

Implication for this repo: this zip includes a small `.github/copilot-instructions.md` adapter so Copilot surfaces that do not load AGENTS.md directly still receive the core workflow pointer.

### GitHub Copilot recommends skills for detailed task-specific instructions

GitHub Copilot docs recommend custom instructions for simple instructions relevant to almost every task, and skills for detailed instructions that should only be accessed when relevant.

Source: https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills

Implication for this repo: the split is directionally correct. Always-on instructions should be short; detailed task procedures should be routed or skill-based.

## Design conclusion

The verified pattern is:

1. Keep root `AGENTS.md` short, strict, and always-on.
2. Put only universal rules in root.
3. Put task-specific details in routed files.
4. Avoid eager imports for token-saving.
5. Require a read receipt so the agent proves which routed files it used.
6. Use tool-specific adapters only where a tool does not reliably load `AGENTS.md` for the relevant surface.

## Known limitation

This design relies on the agent obeying the root router. It is not a hard enforcement layer. Enforce critical behavior with CI, tests, branch protection, GitHub review requirements, sandbox/permission settings, and owner review.
