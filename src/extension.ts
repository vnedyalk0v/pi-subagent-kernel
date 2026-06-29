import { registerSubagentTools, type PiExtensionApi } from "./tools/subagent-tools.ts";

/** Pi extension entrypoint. Keep startup side effects limited to registration. */
export default function extension(pi: PiExtensionApi): void {
  registerSubagentTools(pi);
}

export const activate = extension;
