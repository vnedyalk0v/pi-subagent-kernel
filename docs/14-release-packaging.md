# Release and Packaging Plan

## Package manifest

Pi packages declare extension entrypoints through package metadata. Exact manifest fields should be verified against the current Pi package docs and examples before publishing.

Conceptual `package.json`:

```json
{
  "name": "@your-scope/pi-subagent-kernel",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "pi": {
    "extensions": ["./dist/index.js"]
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": ">=0.80.0"
  }
}
```

Verify peer version before final release.

## Versioning

Use semantic versioning:

- `0.x`: unstable development.
- `0.1`: MVP tools and SDK/subprocess backends.
- `0.2`: artifact store, inspect, better UI.
- `0.3`: worktree backend.
- `0.4`: compatibility importers.
- `1.0`: stable schemas, migration policy, documented API.

Breaking changes before `1.0` must still be documented.

## Configuration

Recommended user config shape:

```json
{
  "subagents": {
    "enabled": true,
    "maxThreads": 4,
    "maxDepth": 1,
    "defaultRuntime": "auto",
    "projectAgents": "ask",
    "compatAliases": false,
    "persistRuns": true,
    "artifactRetentionDays": 14,
    "policy": {
      "network": "none",
      "filesystem": "read-only",
      "nestedSubagents": false
    }
  }
}
```

Do not finalize file paths until current Pi config-dir APIs are inspected.

## Release checklist

Before publishing:

- [ ] Confirm supported Pi version range.
- [ ] Confirm package manifest loads in Pi.
- [ ] Run unit tests.
- [ ] Run integration tests.
- [ ] Run subprocess leak tests.
- [ ] Run manual Pi smoke test.
- [ ] Verify no secrets in test artifacts.
- [ ] Verify `npm pack` contents.
- [ ] Install package from local tarball.
- [ ] Update README with install and safety notes.
- [ ] Update changelog.

## Install docs

Document both forms:

```bash
pi install npm:@your-scope/pi-subagent-kernel
```

Development:

```bash
pi -e ./src/index.ts
```

Verify exact commands with the current Pi docs and local package behavior.

## Security note

Include this prominently:

> This package can execute code through Pi extension hooks and subagent backends. Review source before installing. This package enforces agent-harness permissions but is not a hardened OS sandbox.

## Migration notes

From existing packages:

- If users already have a package registering `subagent` or `Agent`, keep compatibility aliases disabled until conflicts are resolved.
- Provide `/agents doctor` to detect conflicting tool names.
- Provide import-only mode for existing agent definitions.
- Do not delete or rewrite existing agent files automatically.

## Changelog format

```md
# Changelog

## 0.1.0

### Added
- `subagent_spawn`, `subagent_status`, `subagent_result`, `subagent_cancel`.
- Built-in scout/reviewer/tester/summarizer agents.
- SDK and subprocess backends.

### Security
- Project-local agents require trust.
- Nested subagents disabled by default.
```

## Documentation requirements

Published README must include:

- What the package does.
- What it does not do.
- Safety model.
- Install instructions.
- Minimal examples.
- Tool API summary.
- Agent definition examples.
- Troubleshooting.
- Source/audit warning.
