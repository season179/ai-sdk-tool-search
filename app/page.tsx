"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageReasoning,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import {
  type ChatMessageMetadata,
  formatTokenCount,
  formatTokenPercentage,
  getTokenUsage,
  getTokenUsageBreakdown,
  sumTokenUsages,
  type TokenUsage,
  type TokenUsageBreakdown,
} from "@/lib/token-usage";

const BUSY_STATUSES = new Set(["submitted", "streaming"]);
type ChatMessage = UIMessage<ChatMessageMetadata>;

export default function ChatPage() {
  const [input, setInput] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { messages, sendMessage, status, error, stop, regenerate } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isBusy = BUSY_STATUSES.has(status);
  const canSubmit = input.trim().length > 0 && !isBusy;
  const tokenUsageSummary = useMemo(() => {
    const assistantMessages = messages.filter((message) => message.role === "assistant");
    const latestAssistantMessage = assistantMessages.at(-1);

    return {
      latestBreakdown: getTokenUsageBreakdown(latestAssistantMessage?.metadata),
      latestUsage: getTokenUsage(latestAssistantMessage?.metadata),
      sessionUsage: sumTokenUsages(
        assistantMessages.map((message) => getTokenUsage(message.metadata)),
      ),
    };
  }, [messages]);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      const inputElement = inputRef.current;

      if (!inputElement || inputElement.disabled) {
        return;
      }

      inputElement.focus();
      inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
    });
  }, []);

  useEffect(() => {
    const content = contentRef.current;

    if (!content) {
      return;
    }

    content.scrollTo({
      top: content.scrollHeight,
      behavior: "smooth",
    });
  });

  useEffect(() => {
    if (!isBusy) {
      focusInput();
    }
  }, [focusInput, isBusy]);

  function handleSubmit(message: PromptInputMessage) {
    const text = message.text.trim();

    if (!text || isBusy) {
      focusInput();
      return;
    }

    sendMessage({ text });
    setInput("");
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="bg-background/95 px-4 py-3 sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">OpenRouter Chat</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              <span>{isBusy ? "Responding" : "Ready"}</span>
            </div>
          </div>
          <TokenUsageMenu
            latestBreakdown={tokenUsageSummary.latestBreakdown}
            latestUsage={tokenUsageSummary.latestUsage}
            sessionUsage={tokenUsageSummary.sessionUsage}
          />
        </div>
      </header>

      <Conversation className="px-4 sm:px-8 lg:px-10">
        <ConversationContent className="mx-auto w-full max-w-7xl py-6 sm:py-10" ref={contentRef}>
          {messages.length === 0 ? (
            <ConversationEmptyState title="How can I help?" />
          ) : (
            messages.map((message) => {
              const reasoningText = message.parts
                .filter((part) => part.type === "reasoning")
                .map((part) => part.text.trim())
                .filter(Boolean)
                .join("\n\n");
              const responseText = message.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n\n");
              const hasResponseText = responseText.trim().length > 0;
              const isReasoningStreaming = message.parts.some(
                (part) => part.type === "reasoning" && part.state === "streaming",
              );

              return (
                <Message from={message.role} key={message.id}>
                  <MessageContent from={message.role}>
                    {reasoningText ? (
                      <MessageReasoning open={isReasoningStreaming && !hasResponseText}>
                        {reasoningText}
                      </MessageReasoning>
                    ) : null}
                    {hasResponseText ? (
                      <MessageResponse className={reasoningText ? "mt-3" : undefined}>
                        {responseText}
                      </MessageResponse>
                    ) : null}
                  </MessageContent>
                </Message>
              );
            })
          )}

          {status === "submitted" ? (
            <Message from="assistant">
              <MessageContent from="assistant">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className="size-2 animate-pulse rounded-full bg-primary" />
                  Connecting...
                </span>
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>

        {messages.length > 2 ? (
          <ConversationScrollButton
            onClick={() => {
              contentRef.current?.scrollTo({
                top: contentRef.current.scrollHeight,
                behavior: "smooth",
              });
            }}
          />
        ) : null}
      </Conversation>

      {error ? (
        <div
          className="mx-4 mb-3 flex items-start gap-3 rounded-lg border border-destructive/30 bg-background px-4 py-3 text-sm text-destructive sm:mx-8 lg:mx-10"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Chat request failed</p>
            <p className="mt-1 break-words text-destructive/80">{error.message}</p>
          </div>
          <Button onClick={() => regenerate()} size="sm" type="button" variant="outline">
            Retry
          </Button>
        </div>
      ) : null}

      <div className="bg-background px-4 py-3 sm:px-8 sm:py-5 lg:px-10">
        <PromptInput className="mx-auto w-full max-w-7xl" onSubmit={handleSubmit}>
          <PromptInputTextarea
            aria-label="Message"
            disabled={isBusy}
            ref={inputRef}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Send a message..."
            value={input}
          />
          <PromptInputSubmit disabled={!canSubmit} onStop={stop} status={status} />
        </PromptInput>
      </div>
    </main>
  );
}

function TokenUsageMenu({
  latestBreakdown,
  latestUsage,
  sessionUsage,
}: {
  latestBreakdown?: TokenUsageBreakdown;
  latestUsage?: TokenUsage;
  sessionUsage: TokenUsage;
}) {
  return (
    <details className="relative shrink-0 text-right">
      <summary className="-mr-2 block cursor-pointer list-none rounded-md px-2 py-1 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
        <span className="block text-xs text-muted-foreground">Session tokens</span>
        <span className="block tabular-nums text-sm font-semibold text-foreground">
          {formatTokenCount(sessionUsage.totalTokens)}
        </span>
      </summary>
      <div className="absolute right-0 top-full z-20 mt-3 w-[min(calc(100vw-2rem),34rem)] rounded-lg border border-border bg-background p-4 text-left shadow-[0_24px_70px_-36px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Last request</p>
            <p className="mt-1 text-xs text-muted-foreground">
              OpenRouter totals are exact. The split below estimates what made up the input.
            </p>
          </div>
          <p className="shrink-0 tabular-nums text-sm font-semibold text-foreground">
            {formatTokenCount(latestUsage?.totalTokens)}
          </p>
        </div>

        {latestUsage ? <ProviderUsageGrid usage={latestUsage} /> : null}
        {latestBreakdown ? <PromptAllocation breakdown={latestBreakdown} /> : null}

        {!latestUsage ? (
          <p className="mt-4 text-xs text-muted-foreground">Send a message to see usage.</p>
        ) : null}
      </div>
    </details>
  );
}

function ProviderUsageGrid({ usage }: { usage: TokenUsage }) {
  const rows = [
    {
      description: "Prompt tokens: chat history, tools, and options sent in",
      label: "Sent to model",
      value: usage.inputTokens,
    },
    {
      description: "Completion tokens: visible answer plus any thinking",
      label: "Generated output",
      value: usage.outputTokens,
    },
    {
      description: "Reasoning tokens inside generated output",
      label: "Thinking subset",
      value: usage.reasoningTokens,
    },
    {
      description: "Input tokens reused from provider cache",
      label: "Cache read",
      value: usage.cachedInputTokens,
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((row) => (
        <div
          className="min-h-[5.75rem] rounded-md border border-border/80 px-3 py-2"
          key={row.label}
        >
          <p className="text-[11px] font-medium text-foreground">{row.label}</p>
          <p className="mt-1 tabular-nums text-sm font-semibold text-foreground">
            {formatTokenCount(row.value)}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{row.description}</p>
        </div>
      ))}
    </div>
  );
}

function PromptAllocation({ breakdown }: { breakdown: TokenUsageBreakdown }) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold text-foreground">Estimated input-token split</p>
        <p className="text-[11px] text-muted-foreground">
          {breakdown.requestCount} request{breakdown.requestCount === 1 ? "" : "s"} ·{" "}
          {breakdown.toolCount} tools
        </p>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
        {breakdown.categories.map((category) => (
          <span
            className={getBreakdownBarColor(category.id)}
            key={category.id}
            style={{
              minWidth: category.tokens > 0 ? 2 : 0,
              width: `${category.percentage}%`,
            }}
          />
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {breakdown.categories.map((category) => {
          const copy = getBreakdownCategoryCopy(category.id, breakdown);

          return (
            <div className="flex items-start justify-between gap-4 text-xs" key={category.id}>
              <span className="flex min-w-0 items-start gap-2">
                <span
                  className={`mt-1 size-2 shrink-0 rounded-sm ${getBreakdownDotColor(category.id)}`}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{copy.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {copy.description}
                  </span>
                </span>
              </span>
              <span className="shrink-0 pt-0.5 tabular-nums text-foreground">
                {formatTokenCount(category.tokens)} · {formatTokenPercentage(category.percentage)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getBreakdownCategoryCopy(
  id: TokenUsageBreakdown["categories"][number]["id"],
  breakdown: TokenUsageBreakdown,
) {
  switch (id) {
    case "tools":
      return {
        description: `${formatTokenCount(breakdown.toolCount)} available tool schemas sent to the provider`,
        label: "Tool definitions",
      };
    case "messages":
      return {
        description: "User, assistant, and tool-result messages in the conversation",
        label: "Conversation",
      };
    case "systemPrompt":
      return {
        description: "Hidden app and system instructions, when present",
        label: "System instructions",
      };
    case "requestSettings":
      return {
        description: "Model, streaming, routing, and generation parameters",
        label: "Request options",
      };
  }
}

function getBreakdownBarColor(id: TokenUsageBreakdown["categories"][number]["id"]) {
  switch (id) {
    case "tools":
      return "bg-amber-500";
    case "messages":
      return "bg-sky-500";
    case "systemPrompt":
      return "bg-violet-500";
    case "requestSettings":
      return "bg-slate-400";
  }
}

function getBreakdownDotColor(id: TokenUsageBreakdown["categories"][number]["id"]) {
  switch (id) {
    case "tools":
      return "bg-amber-500";
    case "messages":
      return "bg-sky-500";
    case "systemPrompt":
      return "bg-violet-500";
    case "requestSettings":
      return "bg-slate-400";
  }
}
