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
        "px-4 py-3 text-sm leading-6",
        from === "user"
          ? "max-w-[min(46rem,82%)] rounded-lg bg-primary text-primary-foreground"
          : "max-w-[min(72rem,100%)] text-card-foreground",
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
