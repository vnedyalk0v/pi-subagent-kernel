# Release and Packaging Plan

## Package manifest

Pi packages declare extension entrypoints through package metadata. Exact manifest fields should be verified against the current Pi package docs and examples before publishing.

Beta-prep `package.json` essentials:

```json
{
  "name": "pi-subagent-kernel",
  "version": "0.1.0-beta.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "src", "README.md", "LICENSE"],
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

The package exports built JavaScript from `dist` for Node consumers, while Pi loads the TypeScript source entrypoint so local-path, git, and tarball installs do not require committed build artifacts. The current extension code uses a structural Pi API type and does not import Pi runtime packages, so no Pi peer dependency is bundled for beta pack validation. If future code imports `@earendil-works/*` Pi packages, follow Pi package docs and list those packages as peer dependencies with an appropriate owner-reviewed range before release.

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

Before npm publication is approved, document and verify the local tarball install path:

```bash
npm ci
npm run build
npm pack
npm install /path/to/pi-subagent-kernel-0.1.0-beta.0.tgz
```

After a future approved publish, document the npm install form:

```bash
pi install npm:pi-subagent-kernel
```

Development remains:

```bash
pi -e ./src/index.ts
```

Do not claim the npm package install form is verified until the package is published and tested through Pi.

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
