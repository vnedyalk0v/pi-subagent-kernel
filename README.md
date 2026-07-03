# Pi SubAgent Kernel

[![CI](https://github.com/vnedyalk0v/pi-subagent-kernel/actions/workflows/ci.yml/badge.svg)](https://github.com/vnedyalk0v/pi-subagent-kernel/actions/workflows/ci.yml)

This repository is intended to be the starting documentation set and staged implementation for a better SubAgents implementation for the Pi Coding Agent.

It contains source-backed specifications plus the TypeScript package work as it is built. The documents separate **verified external facts** from **design recommendations** so an AI coding agent can build from them without turning research notes into false requirements.

## Current implementation status

The package exports core contracts, in-memory agent and run registries, safe built-in MVP agent definitions (`scout`, `reviewer`, `tester`, `summarizer`), a `.pi/agents/*.md` loader that requires explicit project trust, and a Pi extension entrypoint that registers the canonical MVP tool names. `subagent_spawn` now enforces deny-by-default spawn policy before the mock backend runs, returns structured mock-backend results from `MockExecutionBackend`, `subagent_status` lists or returns in-memory run status, `subagent_result` returns stored envelopes or running status, and `subagent_cancel` cancels queued or active in-memory runs. `SubprocessExecutionBackend` is exported as an alpha backend with fixture-tested spawn, stdout/stderr capture, timeout, cancellation, and RPC result parsing; live model-result smoke testing is still required before README claims real Pi child execution support. `tests/extension/extension.test.ts` is the mock extension-load harness for local validation without a live Pi session.

## Local mock demo

Verified command:

```bash
npm run demo:mock
```

The command builds the package and runs `examples/mock-backend-demo.mjs`. It prints JSON showing a local `subagent_spawn` → `subagent_status` → `subagent_result` flow plus `subagent_cancel` on a queued in-memory run.

This demo is mock-only: it exercises local tool handlers and `MockExecutionBackend`; it does not start Pi, spawn a subprocess, call a model, or use the network.

## Alpha dogfood scenario

Verified command:

```bash
npm run build && node examples/dogfood-alpha-scenario.mjs
```

The command runs a deterministic local subprocess fixture for the `scout`, `reviewer`, `tester`, and `summarizer` built-ins and prints structured JSON. Results and follow-up tracking are documented in `docs/dogfood-alpha-scenario.md`.

This scenario is alpha dogfood only: it does not call a model, use the network, start a live Pi child, or claim production readiness.

## What to build

Build a Pi extension/package that provides a stable, safe, observable SubAgents layer:

- Pi-native extension entrypoint with registered tools and slash commands.
- Isolated child agents with a standard lifecycle and result envelope.
- Multiple execution backends: SDK/in-process, subprocess, worktree, mux/tmux, and future remote workers.
- Markdown + YAML agent definitions compatible with Pi/Claude-style agent files and importable from Codex TOML agent files.
- Context isolation by default; no parent transcript dump unless explicitly requested.
- Strict permissions, depth/concurrency/cost/time limits, and project-trust handling.
- Live observability without flooding the main context.

## Read order

1. `AGENTS.md` — rules for any AI coding agent working in this repo.
2. `docs/00-source-basis.md` — verified facts, source scope, and claims policy.
3. `docs/01-product-brief.md` — product direction and non-goals.
4. `docs/02-requirements.md` — MVP and later-phase requirements.
5. `docs/03-architecture.md` through `docs/08-observability-ux.md` — core technical design.
6. `docs/09-built-in-agents-and-workflows.md` — built-in agent library and workflows.
7. `docs/10-implementation-plan.md` and `docs/11-test-plan.md` — execution plan and quality gates.
8. `docs/12-compatibility.md` — Codex, Claude, OpenCode, and Pi ecosystem compatibility.
9. `docs/15-ai-coding-agent-prompts.md` — prompts you can paste into your coding agent to start implementation.

## Repository layout recommended by these docs

```text
.
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── docs/
│   ├── 00-source-basis.md
│   ├── 01-product-brief.md
│   ├── 02-requirements.md
│   ├── 03-architecture.md
│   ├── 04-agent-definition-spec.md
│   ├── 05-tool-api.md
│   ├── 06-runtime-backends.md
│   ├── 07-context-safety-permissions.md
│   ├── 08-observability-ux.md
│   ├── 09-built-in-agents-and-workflows.md
│   ├── 10-implementation-plan.md
│   ├── 11-test-plan.md
│   ├── 12-compatibility.md
│   ├── 13-risk-register.md
│   ├── 14-release-packaging.md
│   ├── 15-ai-coding-agent-prompts.md
│   └── ADR.md
└── examples/
    └── agents/
        ├── scout.md
        ├── planner.md
        ├── reviewer.md
        ├── tester.md
        ├── implementer.md
        ├── summarizer.md
        ├── security-auditor.md
        └── docs-researcher.md
```

## Source baseline

The documents were prepared from the current public Pi, Codex, and Claude documentation and current Pi package pages checked on **2026-06-26**. Third-party Pi package pages are treated as package-author claims, not independent audits.

Primary source URLs:

- Pi home: https://pi.dev/
- Pi extensions docs: https://pi.dev/docs/latest/extensions
- Pi package catalog: https://pi.dev/packages
- Pi news/release notes: https://pi.dev/news
- OpenAI Codex subagents: https://developers.openai.com/codex/subagents
- Claude Code subagents: https://code.claude.com/docs/en/sub-agents
- Claude Agent SDK subagents: https://code.claude.com/docs/en/agent-sdk/subagents
- Claude Agent SDK permissions: https://code.claude.com/docs/en/agent-sdk/permissions

## Design promise

> Codex-style explicit parallel agents, Claude-style isolated contexts, and Pi-native extensibility — with durable runs, structured results, safe permissions, and pluggable execution backends.

## First implementation target

The MVP should support:

- `subagent_spawn`, `subagent_status`, `subagent_result`, and `subagent_cancel` tools.
- `/agents` command with a minimal status view.
- Markdown/YAML agent definitions.
- SDK and subprocess backends.
- Standard result envelope.
- Concurrency limit, depth limit, runtime timeout, and tool allowlists.
- Built-in `scout`, `reviewer`, `tester`, and `summarizer` agents; defer `implementer` until write-capable safety exists.

Anything beyond that should be implemented only after the MVP test suite is green.
