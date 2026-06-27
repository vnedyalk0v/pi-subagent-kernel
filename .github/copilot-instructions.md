# Copilot repository instructions

Root `AGENTS.md` is the canonical workflow for this repository.

For Copilot surfaces that support `AGENTS.md`, follow it directly. For surfaces that only support `.github/copilot-instructions.md`, apply these always-on rules:

- Use canonical name: Pi SubAgent Kernel / `pi-subagent-kernel`.
- Keep changes issue-scoped and assigned to `vnedyalk0v` when GitHub metadata can be edited.
- Never work directly on `main`.
- Do not merge PRs or publish npm packages without explicit owner instruction.
- Do not relax safety defaults without issue/owner authority and tests.
- Do not claim tests passed unless they were run and passed.
- Do not commit secrets or hidden chain-of-thought.
- Use `.github/instructions/**/*.instructions.md` only as thin path-specific guidance; root `AGENTS.md` remains authoritative.
