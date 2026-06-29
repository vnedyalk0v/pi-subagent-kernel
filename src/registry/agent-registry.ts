import { parseAgentDefinition, type AgentDefinition } from "../contracts/agent-definition.ts";

export class DuplicateAgentNameError extends Error {
  readonly agentName: string;

  constructor(agentName: string) {
    super(`Duplicate agent name "${agentName}".`);
    this.name = "DuplicateAgentNameError";
    this.agentName = agentName;
  }
}

/** In-memory registry for validated agent definitions. No persistence. */
export class AgentRegistry {
  readonly #agents = new Map<string, AgentDefinition>();

  register(input: unknown): AgentDefinition {
    const definition = parseAgentDefinition(input);
    const key = normalizeAgentName(definition.name);

    if (this.#agents.has(key)) {
      throw new DuplicateAgentNameError(definition.name);
    }

    this.#agents.set(key, definition);
    return definition;
  }

  get(name: string): AgentDefinition | undefined {
    return this.#agents.get(normalizeAgentName(name));
  }

  list(): AgentDefinition[] {
    return [...this.#agents.values()];
  }
}

function normalizeAgentName(name: string): string {
  return name.trim().toLowerCase();
}
