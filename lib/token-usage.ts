import type { LanguageModelUsage } from "ai";

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
};

export type ChatMessageMetadata = {
  tokenUsage?: TokenUsage;
};

export function toTokenUsage(usage: LanguageModelUsage): TokenUsage {
  return compactTokenUsage({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.outputTokenDetails.reasoningTokens ?? usage.reasoningTokens,
    cachedInputTokens: usage.inputTokenDetails.cacheReadTokens ?? usage.cachedInputTokens,
    totalTokens: usage.totalTokens,
  });
}

export function getTokenUsage(metadata: unknown): TokenUsage | undefined {
  if (!isRecord(metadata) || !isRecord(metadata.tokenUsage)) {
    return undefined;
  }

  return compactTokenUsage({
    inputTokens: readTokenCount(metadata.tokenUsage.inputTokens),
    outputTokens: readTokenCount(metadata.tokenUsage.outputTokens),
    reasoningTokens: readTokenCount(metadata.tokenUsage.reasoningTokens),
    cachedInputTokens: readTokenCount(metadata.tokenUsage.cachedInputTokens),
    totalTokens: readTokenCount(metadata.tokenUsage.totalTokens),
  });
}

export function sumTokenUsages(usages: Iterable<TokenUsage | undefined>): TokenUsage {
  let total: TokenUsage = {};

  for (const usage of usages) {
    if (!usage) {
      continue;
    }

    total = {
      inputTokens: addTokenCounts(total.inputTokens, usage.inputTokens),
      outputTokens: addTokenCounts(total.outputTokens, usage.outputTokens),
      reasoningTokens: addTokenCounts(total.reasoningTokens, usage.reasoningTokens),
      cachedInputTokens: addTokenCounts(total.cachedInputTokens, usage.cachedInputTokens),
      totalTokens: addTokenCounts(total.totalTokens, usage.totalTokens),
    };
  }

  return total;
}

export function formatTokenCount(value: number | undefined) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function compactTokenUsage(usage: TokenUsage): TokenUsage {
  return Object.fromEntries(
    Object.entries(usage).filter((entry): entry is [keyof TokenUsage, number] => {
      const value = entry[1];

      return typeof value === "number" && Number.isFinite(value);
    }),
  );
}

function addTokenCounts(first: number | undefined, second: number | undefined): number | undefined {
  return first == null && second == null ? undefined : (first ?? 0) + (second ?? 0);
}

function readTokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
