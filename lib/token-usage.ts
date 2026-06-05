import type { LanguageModelUsage } from "ai";

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  totalTokens?: number;
};

export type RequestTokenEstimate = {
  systemPromptChars: number;
  messageChars: number;
  toolChars: number;
  settingsChars: number;
  messageCount: number;
  toolCount: number;
};

export type TokenUsageBreakdownCategoryId =
  | "systemPrompt"
  | "messages"
  | "tools"
  | "requestSettings";

export type TokenUsageBreakdownCategory = {
  id: TokenUsageBreakdownCategoryId;
  label: string;
  tokens: number;
  percentage: number;
  chars: number;
};

export type TokenUsageBreakdown = {
  inputTokens?: number;
  estimated: true;
  requestCount: number;
  messageCount: number;
  toolCount: number;
  categories: TokenUsageBreakdownCategory[];
};

export type ChatMessageMetadata = {
  tokenUsage?: TokenUsage;
  tokenUsageBreakdown?: TokenUsageBreakdown;
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

export function getTokenUsageBreakdown(metadata: unknown): TokenUsageBreakdown | undefined {
  if (!isRecord(metadata) || !isRecord(metadata.tokenUsageBreakdown)) {
    return undefined;
  }

  const breakdown = metadata.tokenUsageBreakdown;
  const categories = Array.isArray(breakdown.categories)
    ? breakdown.categories.map(readBreakdownCategory).filter(isDefined)
    : [];

  if (categories.length === 0) {
    return undefined;
  }

  return {
    inputTokens: readTokenCount(breakdown.inputTokens),
    estimated: true,
    requestCount: readPositiveInteger(breakdown.requestCount) ?? 1,
    messageCount: readPositiveInteger(breakdown.messageCount) ?? 0,
    toolCount: readPositiveInteger(breakdown.toolCount) ?? 0,
    categories,
  };
}

export function estimateRequestTokenUsage(body: unknown): RequestTokenEstimate | undefined {
  const requestBody = parseRequestBody(body);

  if (!isRecord(requestBody)) {
    return undefined;
  }

  const messages = Array.isArray(requestBody.messages) ? requestBody.messages : [];
  const systemMessages = messages.filter(isSystemMessage);
  const nonSystemMessages = messages.filter((message) => !isSystemMessage(message));
  const tools = requestBody.tools ?? requestBody.functions;
  const settings = { ...requestBody };

  delete settings.messages;
  delete settings.tools;
  delete settings.functions;

  const estimate: RequestTokenEstimate = {
    systemPromptChars: jsonLength(systemMessages),
    messageChars: jsonLength(nonSystemMessages),
    toolChars: jsonLength(tools),
    settingsChars: jsonLength(settings),
    messageCount: messages.length,
    toolCount: countItems(tools),
  };

  return estimateTotalChars(estimate) > 0 ? estimate : undefined;
}

export function toTokenUsageBreakdown(
  usage: LanguageModelUsage,
  requestEstimates: RequestTokenEstimate[],
): TokenUsageBreakdown | undefined {
  const aggregate = sumRequestTokenEstimates(requestEstimates);

  if (!aggregate || estimateTotalChars(aggregate) === 0) {
    return undefined;
  }

  const inputTokens = usage.inputTokens;
  const targetTokens = inputTokens ?? estimateTokensFromChars(estimateTotalChars(aggregate));
  const categories = allocateCategoryTokens(
    [
      {
        id: "systemPrompt",
        label: "System instructions",
        chars: aggregate.systemPromptChars,
      },
      {
        id: "tools",
        label: "Tool definitions",
        chars: aggregate.toolChars,
      },
      {
        id: "messages",
        label: "Conversation",
        chars: aggregate.messageChars,
      },
      {
        id: "requestSettings",
        label: "Request options",
        chars: aggregate.settingsChars,
      },
    ],
    targetTokens,
  );

  return {
    inputTokens,
    estimated: true,
    requestCount: requestEstimates.length,
    messageCount: aggregate.messageCount,
    toolCount: aggregate.toolCount,
    categories,
  };
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

export function formatTokenPercentage(value: number | undefined) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value && value < 1 ? 1 : 0,
  }).format(value ?? 0)}%`;
}

function allocateCategoryTokens(
  categories: Array<{
    id: TokenUsageBreakdownCategoryId;
    label: string;
    chars: number;
  }>,
  targetTokens: number,
): TokenUsageBreakdownCategory[] {
  const visibleCategories = categories.filter((category) => category.chars > 0);
  const totalChars = visibleCategories.reduce((sum, category) => sum + category.chars, 0);

  if (totalChars === 0 || targetTokens <= 0) {
    return [];
  }

  const allocations = visibleCategories.map((category) => {
    const exactTokens = (category.chars / totalChars) * targetTokens;
    const tokens = Math.floor(exactTokens);

    return {
      ...category,
      exactTokens,
      tokens,
    };
  });
  let remainingTokens =
    targetTokens - allocations.reduce((sum, category) => sum + category.tokens, 0);

  for (const category of [...allocations].sort(
    (first, second) =>
      second.exactTokens -
      Math.floor(second.exactTokens) -
      (first.exactTokens - Math.floor(first.exactTokens)),
  )) {
    if (remainingTokens <= 0) {
      break;
    }

    category.tokens += 1;
    remainingTokens -= 1;
  }

  return allocations
    .map(({ exactTokens: _exactTokens, ...category }) => ({
      ...category,
      percentage: targetTokens > 0 ? (category.tokens / targetTokens) * 100 : 0,
    }))
    .sort((first, second) => second.tokens - first.tokens);
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

function readBreakdownCategory(value: unknown): TokenUsageBreakdownCategory | undefined {
  if (!isRecord(value) || !isBreakdownCategoryId(value.id)) {
    return undefined;
  }

  const tokens = readTokenCount(value.tokens);
  const percentage = readTokenCount(value.percentage);
  const chars = readTokenCount(value.chars);

  if (tokens == null || percentage == null || chars == null) {
    return undefined;
  }

  return {
    id: value.id,
    label: typeof value.label === "string" ? value.label : value.id,
    tokens,
    percentage,
    chars,
  };
}

function isBreakdownCategoryId(value: unknown): value is TokenUsageBreakdownCategoryId {
  return (
    value === "systemPrompt" ||
    value === "messages" ||
    value === "tools" ||
    value === "requestSettings"
  );
}

function parseRequestBody(body: unknown): unknown {
  if (typeof body !== "string") {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function isSystemMessage(value: unknown): value is { role: "system" } {
  return isRecord(value) && value.role === "system";
}

function jsonLength(value: unknown): number {
  if (value == null) {
    return 0;
  }

  if (Array.isArray(value) && value.length === 0) {
    return 0;
  }

  if (isRecord(value) && Object.keys(value).length === 0) {
    return 0;
  }

  return JSON.stringify(value).length;
}

function countItems(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (isRecord(value)) {
    return Object.keys(value).length;
  }

  return value == null ? 0 : 1;
}

function estimateTotalChars(estimate: RequestTokenEstimate) {
  return (
    estimate.systemPromptChars + estimate.messageChars + estimate.toolChars + estimate.settingsChars
  );
}

function sumRequestTokenEstimates(
  estimates: RequestTokenEstimate[],
): RequestTokenEstimate | undefined {
  if (estimates.length === 0) {
    return undefined;
  }

  return estimates.reduce<RequestTokenEstimate>(
    (total, estimate) => ({
      systemPromptChars: total.systemPromptChars + estimate.systemPromptChars,
      messageChars: total.messageChars + estimate.messageChars,
      toolChars: total.toolChars + estimate.toolChars,
      settingsChars: total.settingsChars + estimate.settingsChars,
      messageCount: total.messageCount + estimate.messageCount,
      toolCount: Math.max(total.toolCount, estimate.toolCount),
    }),
    {
      systemPromptChars: 0,
      messageChars: 0,
      toolChars: 0,
      settingsChars: 0,
      messageCount: 0,
      toolCount: 0,
    },
  );
}

function estimateTokensFromChars(chars: number) {
  return Math.max(1, Math.round(chars / 4));
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
