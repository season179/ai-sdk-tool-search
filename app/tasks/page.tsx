import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";

import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Scheduled tasks",
};

export default function TasksPage() {
  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b border-border bg-background/95 px-4 py-3 sm:px-8 sm:py-4 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="truncate text-sm font-semibold text-foreground">Scheduled tasks</p>
          <SiteNav />
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <CalendarClock aria-hidden="true" className="size-8 text-muted-foreground" />
          <h1 className="text-sm font-semibold text-foreground">Coming soon</h1>
          <p className="text-sm text-muted-foreground">
            A dedicated page for managing scheduled tasks. For now, use the tasks panel on the chat
            page.
          </p>
        </div>
      </div>
    </main>
  );
}
