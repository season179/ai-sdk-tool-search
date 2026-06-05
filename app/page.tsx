"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AlertCircle, MessageSquare, Sparkles } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

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
  PromptInputStop,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";

const BUSY_STATUSES = new Set(["submitted", "streaming"]);
const EXAMPLE_PROMPTS = [
  "Explain React Server Components in two paragraphs.",
  "Draft a friendly release note for a bug fix.",
  "What should I check before shipping a chat UI?",
];

export default function ChatPage() {
  const [input, setInput] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isBusy = BUSY_STATUSES.has(status);
  const canSubmit = input.trim().length > 0 && !isBusy;

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

  function handleSubmit(message: PromptInputMessage) {
    const text = message.text.trim();

    if (!text || isBusy) {
      return;
    }

    sendMessage({ text });
    setInput("");
  }

  return (
    <main className="flex min-h-dvh flex-col px-3 py-3 sm:px-6">
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        <header className="flex items-center justify-between gap-4 border-b bg-background px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles aria-hidden="true" className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">OpenRouter Chat</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
                <span>{isBusy ? "Responding" : "Ready"}</span>
              </div>
            </div>
          </div>
          {isBusy ? <PromptInputStop onClick={stop} /> : null}
        </header>

        <Conversation className="px-3 sm:px-5">
          <ConversationContent ref={contentRef}>
            {messages.length === 0 ? (
              <ConversationEmptyState
                description="Send a prompt to start a real OpenRouter-backed chat."
                icon={<MessageSquare aria-hidden="true" className="size-10" />}
                title="Start a conversation"
              >
                <div className="mt-6 flex w-full flex-col gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      className="rounded-md border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </ConversationEmptyState>
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
            className="mx-3 mb-3 flex items-start gap-3 rounded-lg border border-destructive/30 bg-background px-4 py-3 text-sm text-destructive sm:mx-5"
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

        <PromptInput className="mx-3 mb-3 sm:mx-5 sm:mb-5" onSubmit={handleSubmit}>
          <PromptInputTextarea
            aria-label="Message"
            disabled={isBusy}
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
          <PromptInputSubmit disabled={!canSubmit} status={status} />
        </PromptInput>
      </div>
    </main>
  );
}
