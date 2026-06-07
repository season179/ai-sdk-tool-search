import { executeMockTool, getMockToolSpec } from "@/lib/mock-tools";

/**
 * Discriminated execution payload stored on each scheduled task. V1 only
 * supports explicit tool calls; new kinds (e.g. a free-form "instruction"
 * run through an agent loop) become new dispatcher branches, not migrations.
 */
export type ScheduledTaskPayload = {
  kind: "tool_call";
  toolName: string;
  arguments: Record<string, unknown>;
};

export class ScheduledPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduledPayloadError";
  }
}

export function parseScheduledTaskPayload(value: unknown): ScheduledTaskPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ScheduledPayloadError("Task payload must be an object.");
  }

  const payload = value as Record<string, unknown>;

  if (payload.kind !== "tool_call") {
    throw new ScheduledPayloadError(
      "Only payloads with kind 'tool_call' are supported in this version.",
    );
  }

  const toolName = typeof payload.toolName === "string" ? payload.toolName.trim() : "";

  if (!toolName) {
    throw new ScheduledPayloadError("Task payload requires a non-empty toolName.");
  }

  if (!getMockToolSpec(toolName)) {
    throw new ScheduledPayloadError(
      `Tool '${toolName}' is not in the tool catalog, so it cannot be scheduled.`,
    );
  }

  const args = payload.arguments;

  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    throw new ScheduledPayloadError("Task payload requires an 'arguments' object.");
  }

  return {
    kind: "tool_call",
    toolName,
    arguments: args as Record<string, unknown>,
  };
}

export async function executeScheduledTaskPayload(payload: ScheduledTaskPayload) {
  switch (payload.kind) {
    case "tool_call": {
      const output = executeMockTool(payload.toolName, payload.arguments);

      if (!output) {
        throw new Error(`Tool '${payload.toolName}' is no longer available.`);
      }

      return output;
    }
    default:
      throw new Error(`Unsupported payload kind '${(payload as { kind: string }).kind}'.`);
  }
}
