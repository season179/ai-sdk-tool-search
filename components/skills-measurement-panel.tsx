"use client";

import { formatTokenCount, type SkillReadTraceEvent, type SkillsMetadata } from "@/lib/token-usage";

export function SkillsMeasurementPanel({ metadata }: { metadata: SkillsMetadata }) {
  const hasResources = metadata.allResourcesTokens > 0 || metadata.resourceReadCount > 0;
  const rows = [
    {
      label: "Enabled",
      value: `${metadata.enabledSkillCount} skills`,
    },
    {
      label: "Metadata",
      value: `${formatTokenCount(metadata.metadataTokens)} tokens`,
    },
    {
      label: "Bodies loaded",
      value: `${formatTokenCount(metadata.activatedBodyTokens)} tokens`,
    },
    {
      label: "Bodies saved",
      value: `${formatTokenCount(metadata.savedBodyTokens)} tokens`,
    },
  ];

  return (
    <div className="mt-4 rounded-md border border-border/80 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-foreground">Skills</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Body layer · {metadata.bodyReadCount} read{metadata.bodyReadCount === 1 ? "" : "s"}
          </p>
        </div>
        <p className="shrink-0 text-[11px] text-muted-foreground">
          baseline {formatTokenCount(metadata.allBodiesTokens)}
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

      {hasResources ? (
        <div className="mt-3 rounded-md border border-border/60 px-2.5 py-2">
          <p className="text-[11px] font-semibold text-foreground">Resource layer</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground">Reads</p>
              <p className="tabular-nums font-semibold text-foreground">
                {metadata.resourceReadCount}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground">Loaded</p>
              <p className="tabular-nums font-semibold text-foreground">
                {formatTokenCount(metadata.activatedResourceTokens)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground">Saved</p>
              <p className="tabular-nums font-semibold text-foreground">
                {formatTokenCount(metadata.savedResourceTokens)}
              </p>
            </div>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            All-resources baseline: {formatTokenCount(metadata.allResourcesTokens)} tokens
            (estimate)
          </p>
        </div>
      ) : null}

      {metadata.trace.length > 0 ? <SkillsTrace trace={metadata.trace} /> : null}
    </div>
  );
}

function SkillsTrace({ trace }: { trace: SkillReadTraceEvent[] }) {
  const visibleTrace = trace.slice(-5);

  return (
    <details className="mt-3 border-t border-border/70 pt-2">
      <summary className="cursor-pointer list-none text-[11px] font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
        Skill trace
        <span className="ml-2 font-normal text-muted-foreground">
          latest {visibleTrace.length} of {trace.length}
        </span>
      </summary>
      <div className="mt-2 space-y-2">
        {visibleTrace.map((event) => (
          <div
            className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-[11px]"
            key={`${event.name}-${event.path ?? "body"}`}
          >
            <span className="font-medium text-foreground">{event.path ? "Resource" : "Body"}</span>
            <span className="min-w-0 text-muted-foreground">
              {event.found
                ? event.path
                  ? `${event.name}/${event.path} loaded`
                  : `${event.name} body loaded`
                : `${event.name}${event.path ? `/${event.path}` : ""} not found`}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
