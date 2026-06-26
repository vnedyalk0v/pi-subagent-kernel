# Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---:|---:|---|
| Recursive agent fanout causes runaway cost or resource use. | High | Medium | Default `maxDepth: 1`, `maxThreads: 4`, nested spawning disabled, explicit policy for coordinator agents. |
| Child agent edits parent working tree unexpectedly. | High | Medium | Read-only default; worktree backend for writes; no unsafe fallback from worktree to parent workspace. |
| Tool allowlist bug lets reviewer write files. | High | Medium | Unit tests, policy engine, tool-call interception where available, deny-by-default. |
| Subprocess cancellation leaves child process running. | High | Medium | Abort propagation, process groups, hard kill after grace period, process leak tests. |
| Project-local malicious agent file is loaded. | High | Medium | Project trust check, confirmation, source diagnostics, disable project agents by config. |
| Imported Claude/Codex config weakens safety policy. | High | Medium | Normalize through effective policy; global caps always win; lossy import warnings. |
| Package claims from ecosystem are inaccurate. | Medium | Medium | Treat package READMEs as evidence only; verify source or local behavior before implementation. |
| Pi API changes break extension. | Medium | Medium | Pin supported Pi versions, inspect installed typings, smoke tests, avoid undocumented APIs. |
| Result schemas are too strict and discard useful results. | Medium | Medium | Preserve raw output as artifact; return validation errors and partial summary. |
| Result schemas are too loose and enable hallucinated findings. | Medium | Medium | Require evidence fields, file/line when available, confidence, tests for false positives. |
| Background UI becomes noisy. | Medium | Medium | Compact status by default, inspect on demand, artifact large outputs. |
| Cost accounting is inaccurate. | Medium | Medium | Use provider usage metadata only when available; mark unknown instead of estimating blindly. |
| Worktree cleanup deletes user work. | High | Low/Medium | Only manage worktrees created by this tool; record marker files; retain on failure by default. |
| Secrets leak into logs/artifacts. | High | Medium | Redaction pass, no env dumps, no command-line secrets, tests for secret patterns. |
| Tool schemas bloat parent prompt. | Medium | Medium | Small canonical tool set, concise descriptions, optional compatibility aliases. |
| Automatic delegation surprises users. | Medium | Medium | Explicit delegation only in MVP; proactive mode opt-in later. |
| Remote workers create auth/network risk. | High | Low in MVP | Exclude remote backend from MVP. |
| In-process backend shares mutable state accidentally. | Medium | Medium | Immutable specs, per-run context, tests for isolation, subprocess backend for risky tasks. |
| Event logs expose child hidden reasoning. | High | Low/Medium | Log tool/progress/result metadata only; do not store hidden chain-of-thought. |
| Multiple packages register conflicting tool names. | Medium | Medium | Canonical names; aliases optional; `/agents doctor` shows conflicts. |

## Highest priority mitigations

1. Implement policy engine before write-capable agents.
2. Implement state machine and cancellation before background fanout.
3. Implement artifact storage before large output workflows.
4. Implement worktree backend before enabling implementation writes by default.
5. Implement compatibility import diagnostics before importing external agent files.

## Explicitly accepted MVP risks

- Active background runs may not survive parent process exit until durable recovery is implemented. The UI must state this honestly.
- SDK backend is not crash-isolated. Use it only for low-risk read-only agents by default.
- Network restrictions are tool/policy-level unless a backend provides OS-level enforcement.
- Third-party package feature comparisons are based on public package pages, not source audits.
