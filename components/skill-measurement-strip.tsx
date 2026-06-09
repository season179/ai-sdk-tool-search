"use client";

import { estimateTokensFromChars, formatTokenCount } from "@/lib/token-usage";
import { cn } from "@/lib/utils";

/**
 * Per-skill token cost across the three progressive-disclosure tiers, framed as
 * always-loaded vs deferred. Mirrors the session-level `SkillsMeasurementPanel`
 * but scoped to the skill being authored, so cost lives beside the editor.
 *
 * Metadata counts `name + description` chars — matching the system-prompt
 * injection measured by `buildSkillsMetadata`. Body and references are deferred:
 * loaded only when an agent calls `skill_read`. All figures use the app-wide
 * chars/4 estimate.
 */
export function SkillMeasurementStrip({
  name,
  description,
  body,
  /** Total chars across all reference bodies, or `null` when references aren't
      loaded yet (still fetching) or unavailable (create mode). */
  referenceChars,
  /** Number of attached references, paired with `referenceChars`. */
  referenceCount,
}: {
  name: string;
  description: string;
  body: string;
  referenceChars: number | null;
  referenceCount: number | null;
}) {
  const metadataTokens = estimateTokensFromChars(name.length + description.length);
  const bodyTokens = estimateTokensFromChars(body.length);
  const referenceTokens = referenceChars === null ? null : estimateTokensFromChars(referenceChars);

  return (
    <section aria-label="Token cost by tier" className="rounded-md border border-border/80">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <p className="text-[11px] font-semibold text-foreground">Token cost</p>
        <p className="text-[10px] text-muted-foreground">chars ÷ 4 estimate</p>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/60">
        <TierCell alwaysLoaded label="Metadata" tier="Always loaded" tokens={metadataTokens} />
        <TierCell label="Body" tier="Deferred" tokens={bodyTokens} />
        <TierCell
          count={referenceCount}
          label="References"
          tier="Deferred"
          tokens={referenceTokens}
        />
      </div>
    </section>
  );
}

function TierCell({
  label,
  tier,
  tokens,
  alwaysLoaded = false,
  count = null,
}: {
  label: string;
  tier: string;
  /** Estimated tokens, or `null` to render an em dash for "not yet known". */
  tokens: number | null;
  alwaysLoaded?: boolean;
  count?: number | null;
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {alwaysLoaded ? (
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
        ) : null}
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-1 tabular-nums text-sm font-semibold text-foreground">
        {tokens === null ? "—" : formatTokenCount(tokens)}
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">tokens</span>
      </p>
      <p
        className={cn(
          "mt-0.5 text-[10px]",
          alwaysLoaded ? "text-primary" : "text-muted-foreground",
        )}
      >
        {tier}
        {count != null ? ` · ${count} ${count === 1 ? "file" : "files"}` : ""}
      </p>
    </div>
  );
}
