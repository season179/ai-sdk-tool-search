"use client";

import {
  formatTokenCount,
  type ToolSearchMetadata,
  type ToolSearchTraceEvent,
} from "@/lib/token-usage";

export function ToolSearchPanel({ metadata }: { metadata: ToolSearchMetadata }) {
  const modeLabel = metadata.mode === "search" ? "Search bridge" : "All tools";
  const rows = [
    {
      label: "Catalog",
      value: `${formatTokenCount(metadata.availableToolCount)} tools`,
    },
    {
      label: "Sent",
      value: `${formatTokenCount(metadata.sentToolCount)} tools`,
    },
    {
      label: "Schema sent",
      value: `${formatTokenCount(metadata.sentSchemaTokens)} tokens`,
    },
    {
      label: "Saved",
      value: `${formatTokenCount(metadata.savedSchemaTokens)} tokens`,
    },
  ];

  return (
    <div className="mt-4 rounded-md border border-border/80 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-foreground">Tool search</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {modeLabel} · {metadata.requestCount} request
            {metadata.requestCount === 1 ? "" : "s"}
          </p>
        </div>
        <p className="shrink-0 text-[11px] text-muted-foreground">
          baseline {formatTokenCount(metadata.baselineSchemaTokens)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {rows.map((row) => (
          <div className="rounded-md bg-muted/45 px-2.5 py-2" key={row.label}>
            <p className="text-[10px] font-medium text-muted-foreground">{row.label}</p>
            <p className="mt-0.5 tabular-nums text-xs font-semibold text-foreground">{row.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span>{metadata.searchCount} searches</span>
        <span>{metadata.describeCount} describes</span>
        <span>{metadata.callCount} calls</span>
        <span>{metadata.deferredToolCount} deferred</span>
      </div>

      {metadata.trace.length > 0 ? <ToolSearchTrace trace={metadata.trace} /> : null}
    </div>
  );
}

function ToolSearchTrace({ trace }: { trace: ToolSearchTraceEvent[] }) {
  const visibleTrace = trace.slice(-5);

  return (
    <details className="mt-3 border-t border-border/70 pt-2">
      <summary className="cursor-pointer list-none text-[11px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
        Search trace
        <span className="ml-2 font-normal text-muted-foreground">
          latest {visibleTrace.length} of {trace.length}
        </span>
      </summary>
      <div className="mt-2 space-y-2">
        {visibleTrace.map((event) => (
          <div
            className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-[11px]"
            key={`${event.kind}-${getToolSearchEventDetail(event)}`}
          >
            <span className="font-medium text-foreground">{getToolSearchEventLabel(event)}</span>
            <span className="min-w-0 text-muted-foreground">{getToolSearchEventDetail(event)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function getToolSearchEventLabel(event: ToolSearchTraceEvent) {
  switch (event.kind) {
    case "search":
      return "Search";
    case "describe":
      return "Describe";
    case "call":
      return "Call";
  }
}

function getToolSearchEventDetail(event: ToolSearchTraceEvent) {
  switch (event.kind) {
    case "search": {
      const names = event.matches
        .slice(0, 3)
        .map((match) => match.name)
        .join(", ");

      return `"${event.query}" -> ${names || "no matches"}`;
    }
    case "describe":
      return event.found ? `${event.name} schema loaded` : `${event.name} not found`;
    case "call":
      return event.found ? `${event.name} invoked` : `${event.name} not found`;
  }
}
