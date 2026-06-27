# MVP order and scope

Read this before implementation planning.

## Build order

Build in this order:

1. Repository hygiene and governance.
2. Static contracts and runtime validation.
3. Permission policy defaults.
4. Backend interface.
5. TypeScript package skeleton.
6. Pi extension shell.
7. Agent registry.
8. `.pi/agents/*.md` loader.
9. Run registry and lifecycle state machine.
10. Mock backend.
11. `subagent_spawn` with mock backend.
12. `subagent_status`.
13. `subagent_result`.
14. `subagent_cancel`.
15. Safety policy enforcement in the spawn path.
16. Unit tests and CI.
17. Subprocess backend research.
18. Subprocess backend alpha.

## MVP non-goals

Do not implement before the relevant milestone:

- Claude importer.
- Codex importer.
- OpenCode importer.
- Worktree backend.
- Workflow/DAG orchestration.
- FleetView or advanced TUI.
- Remote workers.
- Cost accounting.
- npm release.
- Automatic proactive delegation.
- Large built-in agent library.

## First usable MVP

MVP is usable when:

- Package builds.
- Core contracts exist.
- Safety defaults are test-covered.
- `.pi/agents/*.md` loader validates definitions.
- Mock backend returns valid `RunEnvelope` objects.
- `subagent_spawn`, `subagent_status`, `subagent_result`, and `subagent_cancel` work against the mock backend.
- Local validation and CI pass.
- Docs accurately state that execution is mock-only until subprocess alpha lands.

## Do not overbuild

If a design requires persistence, event bus, UI, background worker process, or multiple backend implementations before the current issue can pass, stop and reduce scope or propose a follow-up issue.
