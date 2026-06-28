export const RUN_STATES = Object.freeze([
  "queued",
  "starting",
  "running",
  "waiting_for_input",
  "completed",
  "failed",
  "cancelled",
  "expired",
] as const);

export type RunState = (typeof RUN_STATES)[number];

export function isRunState(value: unknown): value is RunState {
  return typeof value === "string" && (RUN_STATES as readonly string[]).includes(value);
}
