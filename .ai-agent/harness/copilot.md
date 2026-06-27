# GitHub Copilot harness adapter

Use this when the current agent is GitHub Copilot, Copilot coding agent, Copilot Chat, Copilot CLI, or Copilot code review.

Rules:

1. Root `AGENTS.md` remains the canonical workflow when the Copilot surface supports it.
2. `.github/copilot-instructions.md` must be a thin adapter, not a second source of truth.
3. `.github/instructions/**/*.instructions.md` may be path-specific. Keep them short and non-conflicting.
4. If a Copilot surface only supports repository-wide instructions, still follow root `AGENTS.md` when available.
5. Do not rely on Copilot code review to enforce all workflow gates. PR authoring agents must still run local validation, pre-PR verifier, and the `codex-connector bot` loop when applicable.
6. If path-specific instructions and root workflow conflict, root `AGENTS.md` wins.
7. If Copilot cannot update assignees, project fields, or review threads, leave a blocker/comment and ask the owner.
