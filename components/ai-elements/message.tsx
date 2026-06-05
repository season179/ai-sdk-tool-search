"use client";

import type * as React from "react";
import { Streamdown } from "streamdown";

import { cn } from "@/lib/utils";

export function Message({
  className,
  from,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
}) {
  return (
    <article
      className={cn("flex w-full", from === "user" ? "justify-end" : "justify-start", className)}
      data-role={from}
      {...props}
    />
  );
}

export function MessageContent({
  className,
  from,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
}) {
  return (
    <div
      className={cn(
        "max-w-[min(42rem,88%)] rounded-lg px-4 py-3 text-sm leading-6",
        from === "user"
          ? "bg-primary text-primary-foreground"
          : "border bg-card text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function MessageResponse({ children, className }: { children: string; className?: string }) {
  return (
    <Streamdown className={cn("break-words text-sm leading-6", className)}>{children}</Streamdown>
  );
}
