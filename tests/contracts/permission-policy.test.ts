import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AGENT_DEFINITION_DEFAULTS,
  DEFAULT_PERMISSION_POLICY,
  MCP_SERVER_POLICIES,
  PermissionPolicyValidationError,
  parsePermissionPolicy,
  validatePermissionPolicy,
} from "../../src/contracts/index.ts";

describe("PermissionPolicy", () => {
  it("uses the required deny-by-default safety policy", () => {
    const policy = parsePermissionPolicy();

    assert.equal(policy.maxDepth, 1);
    assert.equal(policy.maxThreads, 4);
    assert.equal(policy.nestedSubagents, false);
    assert.equal(policy.filesystem, "read-only");
    assert.equal(policy.network, "none");
    assert.equal(policy.shell, "none");
    assert.equal(policy.childExtensions, "deny-by-default");
    assert.equal(policy.mcpServers, "allowlist-only");
    assert.equal(policy.projectAgentsRequireTrust, true);
    assert.equal(policy.projectAgentsRequireConfirmation, true);
  });

  it("matches agent definition safety defaults where the contracts overlap", () => {
    assert.equal(DEFAULT_PERMISSION_POLICY.maxDepth, AGENT_DEFINITION_DEFAULTS.maxDepth);
    assert.equal(DEFAULT_PERMISSION_POLICY.maxThreads, AGENT_DEFINITION_DEFAULTS.maxThreads);
    assert.equal(DEFAULT_PERMISSION_POLICY.nestedSubagents, AGENT_DEFINITION_DEFAULTS.nestedSubagents);
    assert.equal(DEFAULT_PERMISSION_POLICY.filesystem, AGENT_DEFINITION_DEFAULTS.sandbox.filesystem);
    assert.equal(DEFAULT_PERMISSION_POLICY.network, AGENT_DEFINITION_DEFAULTS.sandbox.network);
    assert.equal(DEFAULT_PERMISSION_POLICY.shell, AGENT_DEFINITION_DEFAULTS.sandbox.shell);
    assert.equal(DEFAULT_PERMISSION_POLICY.childExtensions, AGENT_DEFINITION_DEFAULTS.sandbox.childExtensions);
  });

  it("accepts explicit policy overrides without adding enforcement", () => {
    const policy = parsePermissionPolicy({
      maxDepth: 2,
      maxThreads: 1,
      nestedSubagents: true,
      filesystem: "none",
      network: "ask",
      shell: "ask",
      childExtensions: "allow",
      mcpServers: "none",
      projectAgentsRequireTrust: false,
      projectAgentsRequireConfirmation: false,
    });

    assert.equal(policy.maxDepth, 2);
    assert.equal(policy.maxThreads, 1);
    assert.equal(policy.nestedSubagents, true);
    assert.equal(policy.filesystem, "none");
    assert.equal(policy.network, "ask");
    assert.equal(policy.shell, "ask");
    assert.equal(policy.childExtensions, "allow");
    assert.equal(policy.mcpServers, "none");
    assert.equal(policy.projectAgentsRequireTrust, false);
    assert.equal(policy.projectAgentsRequireConfirmation, false);
  });

  it("rejects invalid policy values with actionable paths", () => {
    const result = validatePermissionPolicy({
      maxDepth: 0,
      maxThreads: 1.5,
      nestedSubagents: "no",
      filesystem: "write-all",
      network: true,
      shell: "sudo",
      childExtensions: "enabled",
      mcpServers: [],
      projectAgentsRequireConfirmation: "yes",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.issues.map((issue) => issue.path), [
        "maxDepth",
        "maxThreads",
        "nestedSubagents",
        "filesystem",
        "network",
        "shell",
        "childExtensions",
        "mcpServers",
        "projectAgentsRequireConfirmation",
      ]);
    }
  });

  it("rejects unknown fields", () => {
    assert.throws(() => parsePermissionPolicy({ fileSystem: "read-only" }), /fileSystem: Unknown field "fileSystem"/);
  });

  it("throws typed validation errors", () => {
    assert.throws(
      () => parsePermissionPolicy({ network: "internet" }),
      (error) =>
        error instanceof PermissionPolicyValidationError &&
        error.issues.some((issue) => issue.path === "network" && /network must be one of/.test(issue.message)),
    );
  });

  it("freezes normalized policies and policy enums", () => {
    const policy = parsePermissionPolicy({});

    assert.throws(() => ((policy as { maxDepth: number }).maxDepth = 99), TypeError);
    assert.throws(() => (MCP_SERVER_POLICIES as unknown as string[]).push("wild-west"), TypeError);
  });
});
