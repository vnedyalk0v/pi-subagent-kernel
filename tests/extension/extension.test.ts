import assert from "node:assert/strict";
import { describe, it } from "node:test";

import extension from "../../src/extension.ts";
import { SUBAGENT_TOOL_NAMES, type PiToolDefinition } from "../../src/tools/subagent-tools.ts";

describe("Pi extension entrypoint", () => {
  it("registers the MVP subagent tool surface", () => {
    const registered: PiToolDefinition[] = [];

    extension({ registerTool: (tool) => registered.push(tool) });

    assert.deepEqual(registered.map((tool) => tool.name), [...SUBAGENT_TOOL_NAMES]);
    assert.equal(new Set(registered.map((tool) => tool.name)).size, SUBAGENT_TOOL_NAMES.length);
    for (const tool of registered) {
      assert.equal(tool.parameters.type, "object");
      assert.equal(tool.parameters.additionalProperties, false);
    }
    for (const tool of registered) {
      assert.doesNotMatch(tool.description, /placeholder/i);
    }
  });
});
