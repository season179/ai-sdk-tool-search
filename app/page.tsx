"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AlertCircle } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
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
  getTokenUsage,
  sumTokenUsages,
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
  const sessionTokenUsage = useMemo(
    () =>
      sumTokenUsages(
        messages
          .filter((message) => message.role === "assistant")
          .map((message) => getTokenUsage(message.metadata)),
      ),
    [messages],
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
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">Session tokens</p>
            <p className="tabular-nums text-sm font-semibold text-foreground">
              {formatTokenCount(sessionTokenUsage.totalTokens)}
            </p>
          </div>
        </div>
      </header>

      <Conversation className="px-4 sm:px-8 lg:px-10">
        <ConversationContent className="mx-auto w-full max-w-7xl py-6 sm:py-10" ref={contentRef}>
          {messages.length === 0 ? (
            <ConversationEmptyState title="How can I help?" />
          ) : (
            messages.map((message) => (
              <Fragment key={message.id}>
                {message.parts.map((part) => {
                  if (part.type !== "text") {
                    return null;
                  }

                  return (
                    <Message from={message.role} key={`${message.id}-${part.type}`}>
                      <MessageContent from={message.role}>
                        <MessageResponse>{part.text}</MessageResponse>
                      </MessageContent>
                    </Message>
                  );
                })}
              </Fragment>
            ))
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
