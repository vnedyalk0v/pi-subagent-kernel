# Alpha dogfood scenario

Verified command:

```bash
npm run build && node examples/dogfood-alpha-scenario.mjs
```

This is an alpha dogfood run against this repository using a deterministic local subprocess fixture. It does **not** call a model, use the network, start a live Pi child, or prove production readiness.

## Flow

1. `scout` maps the files that define and test the current subagent workflow.
2. `reviewer` reviews the alpha dogfood surface and returns structured findings.
3. `tester` identifies the main test-risk for the scenario output.
4. `summarizer` merges the scout, reviewer, and tester envelopes into one structured result.

## Documented result

| Agent | Result evidence |
|---|---|
| `scout` | Reads `README.md`, `docs/dogfood-alpha-scenario.md`, `src/registry/built-in-agents.ts`, `src/tools/subagent-tools.ts`, `src/backends/subprocess-backend.ts`, `examples/mock-backend-demo.mjs`, and `tests/examples/mock-backend-demo.test.ts`. |
| `reviewer` | Produces a low-severity finding that the deterministic dogfood run must not be used as a production-readiness claim. |
| `tester` | Produces a low-severity test-risk finding that live Pi smoke coverage remains outside this deterministic dogfood run. |
| `summarizer` | Deduplicates and carries forward the reviewer and tester findings, with `#26` as the live/manual alpha-readiness follow-up. |

## Follow-up ledger

| Signal | Observed | Follow-up issue |
|---|---:|---|
| False positive | No | None opened. |
| Scenario failure | No | None opened. |
| Known limitation: no live Pi/model smoke in this deterministic fixture | Yes | #26 |

False positives and failures should be filed as new follow-up issues when observed. This deterministic run observed none.
