"use client";

import { ArrowDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Conversation({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("relative flex min-h-0 flex-1 flex-col", className)} {...props} />;
}

export const ConversationContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function ConversationContent({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      aria-live="polite"
      className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-5", className)}
      {...props}
    />
  );
});

export function ConversationEmptyState({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-80 max-w-md flex-1 flex-col items-center justify-center text-center",
        className,
      )}
    >
      <div className="mb-5 rounded-full border bg-background p-4 text-primary">{icon}</div>
      <h1 className="text-2xl font-semibold tracking-normal text-foreground">{title}</h1>
      <p className="mt-2 max-w-[36ch] text-sm leading-6 text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

export function ConversationScrollButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      aria-label="Scroll to latest message"
      className={cn("absolute bottom-4 right-4 rounded-full bg-background", className)}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <ArrowDown className="size-4" />
    </Button>
  );
}
