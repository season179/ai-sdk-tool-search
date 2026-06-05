"use client";

import { ArrowUp, Loader2, Square } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PromptInputMessage = {
  text: string;
};

export type PromptInputProps = Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  onSubmit: (message: PromptInputMessage) => void;
};

export function PromptInput({ className, onSubmit, ...props }: PromptInputProps) {
  return (
    <form
      className={cn(
        "relative rounded-lg border bg-background p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit({ text: String(data.get("message") ?? "") });
      }}
      {...props}
    />
  );
}

export function PromptInputTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "max-h-40 min-h-24 w-full resize-none rounded-md bg-transparent px-3 py-2 pr-16 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70",
        className,
      )}
      name="message"
      rows={3}
      {...props}
    />
  );
}

export function PromptInputSubmit({
  className,
  status,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  status: "ready" | "submitted" | "streaming" | "error";
}) {
  const isBusy = status === "submitted" || status === "streaming";

  return (
    <Button
      aria-label={isBusy ? "Sending message" : "Send message"}
      className={cn("absolute bottom-3 right-3 rounded-full", className)}
      disabled={isBusy || props.disabled}
      size="icon"
      type="submit"
      {...props}
    >
      {isBusy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
    </Button>
  );
}

export function PromptInputStop({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      aria-label="Stop streaming"
      className={cn("rounded-full", className)}
      size="sm"
      type="button"
      variant="outline"
      {...props}
    >
      <Square className="size-3 fill-current" />
      Stop
    </Button>
  );
}
