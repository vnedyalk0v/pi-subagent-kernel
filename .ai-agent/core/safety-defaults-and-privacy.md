# Safety defaults and privacy

Use this file when a task touches permissions, sandboxing, subprocesses, tools, MCP, network, context inheritance, release behavior, secrets, logs, or user data.

## Required safety defaults

The default policy is deny-by-default:

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

Any relaxation is security-sensitive and must be treated as `type:security` and `area:safety` even if labels are missing.

## Context safety

1. Do not pass the full parent transcript to a child agent by default.
2. Default context inheritance should be `summary`, `none`, or another explicit constrained mode defined by the schema.
3. `inheritContext: full` must be explicit and issue-authorized.
4. Child transcripts and tool traces must not be dumped into parent context unless requested for debugging and scrubbed for secrets.
5. Structured results are preferred over free-form text.

## Tool and permission safety

1. Child agents must not silently escalate tools or permissions.
2. Tool allowlists must be enforced in code, not only prompt text.
3. Project-local agent definitions require confirmation before privileged use.
4. Unknown MCP servers, extensions, or packages must not auto-install or auto-enable.
5. Shell, network, filesystem write, package install, git push, release, and publish operations require explicit policy.

## Secrets and privacy

Never commit or paste:

- API keys, tokens, credentials, cookies, private URLs.
- Raw logs that may contain secrets.
- Hidden chain-of-thought or private scratchpad content.
- User-private data unrelated to the issue.
- Private prompts from external systems unless the owner provided them for repo documentation.

If a secret is exposed, stop, notify the owner, and wait for direction.

## Subprocess and backend safety

Subprocess execution must define:

- Spawn command and arguments.
- Environment handling.
- Timeout.
- Cancellation/kill path.
- stdout/stderr capture and redaction.
- Exit code handling.
- Output parsing into `RunEnvelope`.
- Protection against inherited dangerous permissions.

If any of these are unverified, keep the backend mock/research-only.
