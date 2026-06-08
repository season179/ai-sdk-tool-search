"use client";

import { SkillsMeasurementPanel } from "@/components/skills-measurement-panel";
import { ToolSearchPanel } from "@/components/tool-search-panel";
import {
  formatTokenCount,
  formatTokenPercentage,
  type SkillsMetadata,
  type TokenUsage,
  type TokenUsageBreakdown,
  type ToolSearchMetadata,
} from "@/lib/token-usage";

export function TokenUsageMenu({
  latestBreakdown,
  latestSkills,
  latestToolSearch,
  latestUsage,
  sessionUsage,
}: {
  latestBreakdown?: TokenUsageBreakdown;
  latestSkills?: SkillsMetadata;
  latestToolSearch?: ToolSearchMetadata;
  latestUsage?: TokenUsage;
  sessionUsage: TokenUsage;
}) {
  return (
    <details className="relative shrink-0 text-right">
      <summary className="-mr-2 block cursor-pointer list-none rounded-md px-2 py-1 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
        <span className="block text-xs text-muted-foreground">Session tokens</span>
        <span className="block tabular-nums text-sm font-semibold text-foreground">
          {formatTokenCount(sessionUsage.totalTokens)}
        </span>
      </summary>
      <div className="absolute right-0 top-full z-20 mt-3 w-[min(calc(100vw-2rem),34rem)] rounded-lg border border-border bg-background p-4 text-left shadow-[0_24px_70px_-36px_rgba(15,23,42,0.45)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Last request</p>
            <p className="mt-1 text-xs text-muted-foreground">
              OpenRouter totals are exact. The input split estimates model-readable content.
            </p>
          </div>
          <p className="shrink-0 tabular-nums text-sm font-semibold text-foreground">
            {formatTokenCount(latestUsage?.totalTokens)}
          </p>
        </div>

        {latestUsage ? <ProviderUsageGrid usage={latestUsage} /> : null}
        {latestBreakdown ? <PromptAllocation breakdown={latestBreakdown} /> : null}
        {latestSkills ? <SkillsMeasurementPanel metadata={latestSkills} /> : null}
        {latestToolSearch ? <ToolSearchPanel metadata={latestToolSearch} /> : null}

        {!latestUsage ? (
          <p className="mt-4 text-xs text-muted-foreground">Send a message to see usage.</p>
        ) : null}
      </div>
    </details>
  );
}

function ProviderUsageGrid({ usage }: { usage: TokenUsage }) {
  const rows = [
    {
      description: "Prompt tokens: conversation, instructions, and tool definitions",
      label: "Sent to model",
      value: usage.inputTokens,
    },
    {
      description: "Completion tokens: visible answer plus any thinking",
      label: "Generated output",
      value: usage.outputTokens,
    },
    {
      description: "Reasoning tokens inside generated output",
      label: "Thinking subset",
      value: usage.reasoningTokens,
    },
    {
      description: "Input tokens reused from provider cache",
      label: "Cache read",
      value: usage.cachedInputTokens,
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((row) => (
        <div
          className="min-h-[5.75rem] rounded-md border border-border/80 px-3 py-2"
          key={row.label}
        >
          <p className="text-[11px] font-medium text-foreground">{row.label}</p>
          <p className="mt-1 tabular-nums text-sm font-semibold text-foreground">
            {formatTokenCount(row.value)}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{row.description}</p>
        </div>
      ))}
    </div>
  );
}

function PromptAllocation({ breakdown }: { breakdown: TokenUsageBreakdown }) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold text-foreground">Estimated input-token split</p>
        <p className="text-[11px] text-muted-foreground">
          {breakdown.requestCount} request{breakdown.requestCount === 1 ? "" : "s"} ·{" "}
          {breakdown.toolCount} tools
        </p>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
        {breakdown.categories.map((category) => (
          <span
            className={getBreakdownBarColor(category.id)}
            key={category.id}
            style={{
              minWidth: category.tokens > 0 ? 2 : 0,
              width: `${category.percentage}%`,
            }}
          />
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {breakdown.categories.map((category) => {
          const copy = getBreakdownCategoryCopy(category.id, breakdown);

          return (
            <div className="flex items-start justify-between gap-4 text-xs" key={category.id}>
              <span className="flex min-w-0 items-start gap-2">
                <span
                  className={`mt-1 size-2 shrink-0 rounded-sm ${getBreakdownDotColor(category.id)}`}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{copy.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {copy.description}
                  </span>
                </span>
              </span>
              <span className="shrink-0 pt-0.5 tabular-nums text-foreground">
                {formatTokenCount(category.tokens)} · {formatTokenPercentage(category.percentage)}
              </span>
            </div>
          );
        })}
      </div>

      {breakdown.excludedRequestOptionTokens > 0 ? (
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          API options excluded: model, streaming, routing, and generation settings are request
          metadata, not prompt content.
        </p>
      ) : null}

      {breakdown.tools.length > 0 ? <ToolSchemaBreakdown breakdown={breakdown} /> : null}
    </div>
  );
}

function ToolSchemaBreakdown({ breakdown }: { breakdown: TokenUsageBreakdown }) {
  const visibleTools = breakdown.tools.slice(0, 8);
  const hiddenTools = breakdown.tools.slice(8);
  const hiddenTokens = hiddenTools.reduce((sum, tool) => sum + tool.tokens, 0);
  const hiddenPercentage = hiddenTools.reduce((sum, tool) => sum + tool.percentage, 0);

  return (
    <details className="mt-4 rounded-md border border-border/80 px-3 py-2">
      <summary className="cursor-pointer list-none text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
        <span>Tool schema breakdown</span>
        <span className="ml-2 font-normal text-muted-foreground">
          top {visibleTools.length} of {breakdown.tools.length}
        </span>
      </summary>
      <div className="mt-3 space-y-2">
        {visibleTools.map((tool) => (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-xs" key={tool.name}>
            <span className="min-w-0 truncate text-muted-foreground" title={tool.name}>
              {tool.name}
            </span>
            <span className="shrink-0 tabular-nums text-foreground">
              {formatTokenCount(tool.tokens)} · {formatTokenPercentage(tool.percentage)}
            </span>
          </div>
        ))}
        {hiddenTools.length > 0 ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-border/70 pt-2 text-xs">
            <span className="min-w-0 text-muted-foreground">
              Other {hiddenTools.length} tool schemas
            </span>
            <span className="shrink-0 tabular-nums text-foreground">
              {formatTokenCount(hiddenTokens)} · {formatTokenPercentage(hiddenPercentage)}
            </span>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function getBreakdownCategoryCopy(
  id: TokenUsageBreakdown["categories"][number]["id"],
  breakdown: TokenUsageBreakdown,
) {
  switch (id) {
    case "tools":
      return {
        description: `${formatTokenCount(breakdown.toolCount)} available tool schemas sent to the provider`,
        label: "Tool definitions",
      };
    case "messages":
      return {
        description: "User, assistant, and tool-result messages in the conversation",
        label: "Conversation",
      };
    case "systemPrompt":
      return {
        description: "Hidden app and system instructions, when present",
        label: "System instructions",
      };
  }
}

function getBreakdownBarColor(id: TokenUsageBreakdown["categories"][number]["id"]) {
  switch (id) {
    case "tools":
      return "bg-amber-500";
    case "messages":
      return "bg-sky-500";
    case "systemPrompt":
      return "bg-violet-500";
  }
}

function getBreakdownDotColor(id: TokenUsageBreakdown["categories"][number]["id"]) {
  switch (id) {
    case "tools":
      return "bg-amber-500";
    case "messages":
      return "bg-sky-500";
    case "systemPrompt":
      return "bg-violet-500";
  }
}
