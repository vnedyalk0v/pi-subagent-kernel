import assert from "node:assert/strict";
import { describe, it } from "node:test";

import extension from "../../src/extension.ts";
import { SUBAGENT_TOOL_NAMES, createSubagentTools, type PiToolDefinition } from "../../src/tools/subagent-tools.ts";

describe("Pi extension entrypoint", () => {
  it("registers the MVP subagent tool surface", () => {
    const registered: PiToolDefinition[] = [];

    extension({ registerTool: (tool) => registered.push(tool) });

    assert.deepEqual(registered.map((tool) => tool.name), [...SUBAGENT_TOOL_NAMES]);
    assert.equal(new Set(registered.map((tool) => tool.name)).size, SUBAGENT_TOOL_NAMES.length);
    for (const tool of registered) {
      assert.equal(tool.parameters.type, "object");
      assert.equal(tool.parameters.additionalProperties, false);
      assert.match(tool.description, /placeholder/i);
    }
  });

  it("returns structured placeholder details without starting runs", async () => {
    for (const tool of createSubagentTools()) {
      const params = validParams(tool.name);
      const result = await tool.execute("call_1", params);

      assert.match(result.content[0]?.text ?? "", /registered/);
      assert.deepEqual(result.details, {
        tool: tool.name,
        status: "not_implemented",
        issue: 9,
        reason: "The Pi extension shell is loaded, but run registry and backend execution are not implemented yet.",
      });
    }
  });

});

function validParams(toolName: PiToolDefinition["name"]): Record<string, unknown> {
  switch (toolName) {
    case "subagent_spawn":
      return { agent: "scout", task: "Inspect the contracts.", mode: "foreground" };
    case "subagent_status":
      return {};
    case "subagent_result":
      return { id: "run_01" };
    case "subagent_cancel":
      return { id: "run_01", reason: "No longer needed" };
  }
}
