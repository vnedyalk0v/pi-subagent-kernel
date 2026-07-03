# Alpha readiness smoke evidence

Recorded for issue #61 on 2026-07-03 against Pi `0.80.3`.

This evidence supports internal alpha readiness only. It does not claim production readiness, npm publish readiness, live model execution, or live child Pi subprocess execution.

## Commands run locally

| Check | Command | Result | Evidence |
|---|---|---|---|
| Clean install | `npm ci` | Pass | 4 packages installed, audit found 0 vulnerabilities. |
| Typecheck | `npm run typecheck --if-present` | Pass | `tsc -p tsconfig.json --noEmit` completed. |
| Lint | `npm run lint --if-present` | Pass | `tsc -p tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters` completed. |
| Tests | `npm run test --if-present` | Pass | 161 tests passed, 0 failed. |
| Build | `npm run build --if-present` | Pass | `tsc -p tsconfig.json` completed. |
| Mock tool flow | `npm run demo:mock` | Pass | `spawn`, `status`, `result`, and queued `cancel` completed through `MockExecutionBackend`; output has `mockOnly: true` and `piRuntimeTested: false`. |
| Alpha dogfood | `npm run build && node examples/dogfood-alpha-scenario.mjs` | Pass | Scout/reviewer/tester/summarizer fixture acceptance all `true`; `productionReadinessClaimed: false`. |
| Pi extension load smoke | `node examples/alpha-pi-extension-smoke.mjs` | Pass | Pi local development load exposed and activated all four `subagent_*` tools; mock `spawn`/`status`/`result` completed; the registered cancel handler inspected the completed run; queued `cancel` recorded `cancelled`. |
| Diff whitespace | `git diff --check` | Pass | No whitespace errors. |

## Pi extension load smoke details

`node examples/alpha-pi-extension-smoke.mjs` runs Pi in local development mode with no model prompt, no discovered project resources, and offline startup:

```text
pi -p --offline --no-session --no-context-files --no-skills --no-prompt-templates --no-themes --no-extensions --no-approve -e src/index.ts -e <probe> /alpha-load-check
```

Observed result:

```json
{
  "piVersion": "0.80.3",
  "productionReadinessClaimed": false,
  "realModelSmoke": false,
  "network": "offline",
  "directLoad": {
    "requiredToolsRegistered": true,
    "subagentTools": [
      "subagent_spawn",
      "subagent_status",
      "subagent_result",
      "subagent_cancel"
    ],
    "activeSubagentTools": [
      "subagent_spawn",
      "subagent_status",
      "subagent_result",
      "subagent_cancel"
    ]
  },
  "toolFlow": {
    "spawn": { "status": "completed", "mock": true },
    "status": { "agent": "scout", "status": "completed" },
    "result": { "agent": "scout", "runtime": "sdk", "status": "completed", "filesRead": ["README.md"] },
    "registeredCancel": { "status": "completed", "cancelled": false },
    "cancel": { "id": "run_alpha_cancel", "status": "cancelled", "cancelled": true }
  }
}
```

The smoke command verifies extension registration through the supported `pi -e ./src/index.ts` path. The deterministic tool flow uses the same tool registration factory with injected in-memory services inside a Pi process, so it can seed and cancel a queued run without private Pi state. It does not call a provider or start a live child Pi session.

## Safety defaults evidence

The required deny-by-default policy remains:

```text
maxDepth = 1
maxThreads = 4
nestedSubagents = false
filesystem = read-only
network = none
childExtensions = deny-by-default
mcpServers = allowlist-only
projectAgentsRequireConfirmation = true
```

Automated coverage cited by this smoke pass:

- `tests/contracts/permission-policy.test.ts` verifies the default permission policy values.
- `tests/registry/built-in-agents.test.ts` verifies built-in MVP agents keep narrow read-only/default policies.
- `tests/loaders/pi-agent-loader.test.ts` verifies project agent loading requires trust.
- `tests/tools/subagent-spawn.test.ts` verifies spawn-time policy caps, nested subagent denial, unsafe tool rejection, and sandbox policy rejection.
- `tests/extension/extension.test.ts` verifies the Pi extension entrypoint registers strict object schemas for the four MVP tools.

## Known limitations after #61

- No npm package was published.
- Public beta package metadata and tarball validation remain #27.
- Public beta checklist remains #28.
- The local Pi smoke verifies extension loading and mock tool behavior only; no real model/provider smoke was approved or run.
- `SubprocessExecutionBackend` still has fixture-tested process behavior, not a production readiness claim for live model-result extraction or active model-call cancellation.
- `/agents` UI/command work remains post-MVP and is tracked by #32.
