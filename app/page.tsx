"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AlertCircle } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { AppHeader } from "@/components/app-header";
import { TasksPanel } from "@/components/tasks-panel";
import { TokenUsageMenu } from "@/components/token-usage-menu";
import { Button } from "@/components/ui/button";
import { type ChatMessageMetadata, sumTokenUsages } from "@/lib/token-usage";
import {
  getSkillsMetadata,
  getTokenUsage,
  getTokenUsageBreakdown,
  getToolSearchMetadata,
} from "@/lib/token-usage-getters";
import { useMeasuredHeight } from "@/lib/use-measured-height";

const BUSY_STATUSES = new Set(["submitted", "streaming"]);
type ChatMessage = UIMessage<ChatMessageMetadata>;
type ChatShellStyle = CSSProperties & {
  "--composer-height"?: string;
  "--header-height"?: string;
};

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [composerRef, composerHeight] = useMeasuredHeight<HTMLDivElement>();
  const [headerRef, headerHeight] = useMeasuredHeight<HTMLElement>();
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
      latestSkills: getSkillsMetadata(latestAssistantMessage?.metadata),
      latestToolSearch: getToolSearchMetadata(latestAssistantMessage?.metadata),
      latestUsage: getTokenUsage(latestAssistantMessage?.metadata),
      sessionUsage: sumTokenUsages(
        assistantMessages.map((message) => getTokenUsage(message.metadata)),
      ),
    };
  }, [messages]);
  const shellStyle = useMemo<ChatShellStyle | undefined>(
    () =>
      composerHeight === null && headerHeight === null
        ? undefined
        : {
            ...(composerHeight === null ? {} : { "--composer-height": `${composerHeight}px` }),
            ...(headerHeight === null ? {} : { "--header-height": `${headerHeight}px` }),
          },
    [composerHeight, headerHeight],
  );

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
    <main
      className="h-dvh overflow-hidden bg-background [--composer-height:8.75rem] [--header-height:4.5rem] sm:[--composer-height:10.125rem]"
      style={shellStyle}
    >
      <AppHeader
        actions={
          <>
            <TasksPanel />
            <TokenUsageMenu
              latestBreakdown={tokenUsageSummary.latestBreakdown}
              latestSkills={tokenUsageSummary.latestSkills}
              latestToolSearch={tokenUsageSummary.latestToolSearch}
              latestUsage={tokenUsageSummary.latestUsage}
              sessionUsage={tokenUsageSummary.sessionUsage}
            />
          </>
        }
        ref={headerRef}
        status={
          <>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            <span>{isBusy ? "Responding" : "Ready"}</span>
          </>
        }
      />

      <Conversation className="fixed inset-x-0 bottom-[var(--composer-height)] top-[var(--header-height)] px-4 sm:px-8 lg:px-10">
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
            className="bottom-4"
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
          className="fixed inset-x-4 bottom-[calc(var(--composer-height)+0.75rem)] z-50 flex items-start gap-3 rounded-lg border border-destructive/30 bg-background px-4 py-3 text-sm text-destructive shadow-lg sm:inset-x-8 lg:inset-x-10"
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

      <div
        className="fixed inset-x-0 bottom-0 z-40 bg-background/95 px-4 py-3 backdrop-blur sm:px-8 sm:py-5 lg:px-10"
        ref={composerRef}
      >
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
