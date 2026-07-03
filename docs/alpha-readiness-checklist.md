# Alpha readiness checklist

Use this before declaring an internal alpha ready. Checked means evidence was captured in the release issue or PR. Unchecked items must link to a GitHub issue in the tracking column.

## Alpha gates

| Status | Gate | Required evidence | Tracking |
|---|---|---|---|
| [ ] | Install and local setup | Clean checkout can run `npm ci`, then load the package in the supported local Pi development mode. | #61 |
| [ ] | Build | `npm run build` passes on the alpha candidate commit. | #61 |
| [ ] | Test | `npm run typecheck --if-present`, `npm run lint --if-present`, and `npm run test --if-present` pass locally or in CI. | #61 |
| [ ] | Local extension load | The Pi extension entrypoint loads locally and registers `subagent_spawn`, `subagent_status`, `subagent_result`, and `subagent_cancel`. | #61 |
| [ ] | Basic tool flow | A local run exercises `subagent_spawn` → `subagent_status` → `subagent_result`. | #61 |
| [ ] | Cancel flow | A local run exercises `subagent_cancel` and records the resulting cancelled status. | #61 |
| [ ] | Safety defaults | Evidence confirms `maxDepth = 1`, `maxThreads = 4`, `nestedSubagents = false`, `filesystem = read-only`, `network = none`, `childExtensions = deny-by-default`, `mcpServers = allowlist-only`, and `projectAgentsRequireConfirmation = true`. | #61 |
| [ ] | Known limitations | README/docs state what alpha does not prove before any readiness claim is made. | #61 |

## Current evidence sources

- Mock tool flow: `npm run demo:mock` exercises local `subagent_spawn`, `subagent_status`, `subagent_result`, and queued-run `subagent_cancel` through `MockExecutionBackend`.
- Deterministic dogfood: `npm run build && node examples/dogfood-alpha-scenario.mjs` exercises the scout/reviewer/tester/summarizer alpha scenario without model, network, or live Pi child execution.
- Extension-load harness: `tests/extension/extension.test.ts` verifies the extension factory registers the canonical MVP tools with strict object schemas.
- Safety-default coverage: contract, built-in-agent, loader, and spawn-path tests cover deny-by-default policy behavior.

## Known alpha limitations

- Alpha evidence is local and deterministic unless #61 records a live Pi smoke run.
- `SubprocessExecutionBackend` tests use fixture child processes; live model-result extraction and active model-call cancellation are not yet claimed as production-ready.
- `bash:test-only` remains disabled until a guard extension or sandbox exists.
- `/agents` UI/command work is not part of this alpha checklist; it is tracked separately in #32.
- npm publishing and public beta packaging are out of scope for alpha and remain tracked by #27 and #28.

## Tracking rule

Do not leave an unchecked readiness item without an issue link. If an alpha gate fails while executing #61, either update #61 with the failure details or open a focused follow-up issue and replace the tracking link in this checklist.
