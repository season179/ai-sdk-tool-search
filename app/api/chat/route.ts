import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createAgentUIStreamResponse, smoothStream, ToolLoopAgent, type UIMessage } from "ai";

import { mockToolCount, mockTools } from "@/lib/mock-tools";
import { schedulerTools } from "@/lib/scheduler/tool-specs";
import {
  type ChatMessageMetadata,
  estimateRequestTokenUsage,
  type RequestTokenEstimate,
  type ToolSearchTraceEvent,
  toTokenUsage,
  toTokenUsageBreakdown,
} from "@/lib/token-usage";
import {
  buildToolSearchMetadata,
  createToolSearchTools,
  resolveToolExposureMode,
} from "@/lib/tool-search";

export const maxDuration = 30;

const SYSTEM_PROMPT = [
  "Be friendly, concise, and helpful. Use tool_search, tool_describe, and tool_call when hidden tools are needed.",
  "Scheduled tasks (scheduled_task_* tools) are real and persistent, not mocked.",
  "Before creating a scheduled task, ask a follow-up question if the requested time is ambiguous (no date, no timezone, or unclear wording). One-off run_at values must be ISO 8601 with a timezone offset; recurring tasks use cron with an IANA timezone (UTC unless the user says otherwise).",
  "After creating a task, confirm whether it is one-off or recurring, when it runs, and in which timezone.",
].join(" ");

class MissingEnvironmentVariableError extends Error {
  constructor(readonly variableName: "OPENROUTER_API_KEY" | "OPENROUTER_DEFAULT_MODEL") {
    super(`${variableName} is required before chat requests can be sent.`);
    this.name = "MissingEnvironmentVariableError";
  }
}

function requireEnv(variableName: "OPENROUTER_API_KEY" | "OPENROUTER_DEFAULT_MODEL") {
  const value = process.env[variableName]?.trim();

  if (!value) {
    throw new MissingEnvironmentVariableError(variableName);
  }

  return value;
}

function configErrorResponse(error: MissingEnvironmentVariableError) {
  return Response.json(
    {
      error: `${error.variableName} is missing. Add it to .env and restart the dev server.`,
    },
    { status: 500 },
  );
}

export async function POST(req: Request) {
  let messages: UIMessage<ChatMessageMetadata>[];

  try {
    const body: { messages?: UIMessage<ChatMessageMetadata>[] } = await req.json();

    if (!Array.isArray(body.messages)) {
      return Response.json(
        { error: "Request body must include a messages array." },
        { status: 400 },
      );
    }

    messages = body.messages;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const apiKey = requireEnv("OPENROUTER_API_KEY");
    const model = requireEnv("OPENROUTER_DEFAULT_MODEL");
    const openrouter = createOpenRouter({ apiKey });
    const toolExposureMode = resolveToolExposureMode(process.env.TOOL_EXPOSURE_MODE);
    const toolSearchTrace: ToolSearchTraceEvent[] = [];
    const tools =
      toolExposureMode === "all"
        ? { ...mockTools, ...schedulerTools }
        : createToolSearchTools(toolSearchTrace);
    const requestEstimates: RequestTokenEstimate[] = [];

    const agent = new ToolLoopAgent({
      instructions: `${SYSTEM_PROMPT} The current UTC time is ${new Date().toISOString()}.`,
      model: openrouter.chat(model),
      tools,
    });

    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      abortSignal: req.signal,
      experimental_transform: smoothStream({
        chunking: "word",
        delayInMs: 35,
      }),
      sendReasoning: true,
      onStepFinish(step) {
        const estimate = estimateRequestTokenUsage(step.request.body);

        if (estimate) {
          requestEstimates.push(estimate);
        }
      },
      headers: {
        "x-mock-tools": String(mockToolCount),
        "x-total-tools": String(Object.keys(tools).length),
        "x-openrouter-model": model,
        "x-tool-exposure-mode": toolExposureMode,
      },
      messageMetadata({ part }) {
        if (part.type !== "finish") {
          return undefined;
        }

        return {
          tokenUsage: toTokenUsage(part.totalUsage),
          tokenUsageBreakdown: toTokenUsageBreakdown(part.totalUsage, requestEstimates),
          toolSearch: buildToolSearchMetadata({
            mode: toolExposureMode,
            requestEstimates,
            trace: toolSearchTrace,
          }),
        };
      },
      onError(error) {
        console.error("Chat stream failed", error);
        return error instanceof Error ? error.message : "Chat stream failed unexpectedly.";
      },
    });
  } catch (error) {
    if (error instanceof MissingEnvironmentVariableError) {
      return configErrorResponse(error);
    }

    console.error("Chat route failed before streaming started", error);
    return Response.json(
      { error: "Chat request failed before the stream could start." },
      { status: 500 },
    );
  }
}
