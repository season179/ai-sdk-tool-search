import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createAgentUIStreamResponse, smoothStream, ToolLoopAgent, type UIMessage } from "ai";

import { mockToolCount, mockTools } from "@/lib/mock-tools";
import { type ChatMessageMetadata, toTokenUsage } from "@/lib/token-usage";

export const maxDuration = 30;

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
    const tools = mockTools;

    const agent = new ToolLoopAgent({
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
      headers: {
        "x-mock-tools": String(mockToolCount),
        "x-total-tools": String(Object.keys(tools).length),
        "x-openrouter-model": model,
      },
      messageMetadata({ part }) {
        if (part.type !== "finish") {
          return undefined;
        }

        return {
          tokenUsage: toTokenUsage(part.totalUsage),
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
