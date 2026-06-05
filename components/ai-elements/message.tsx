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

export function MessageReasoning({
  children,
  className,
  open,
}: {
  children: string;
  className?: string;
  open?: boolean;
}) {
  if (!children.trim()) {
    return null;
  }

  return (
    <details className={cn("group text-muted-foreground", className)} open={open}>
      <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground marker:text-muted-foreground/70">
        Thinking
      </summary>
      <Streamdown className="mt-2 border-l border-border pl-3 text-xs leading-6 text-muted-foreground">
        {children}
      </Streamdown>
    </details>
  );
}
