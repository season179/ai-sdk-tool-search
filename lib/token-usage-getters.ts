import {
  compactTokenUsage,
  isRecord,
  type SkillReadTraceEvent,
  type SkillsMetadata,
  type TokenUsage,
  type TokenUsageBreakdown,
  type TokenUsageBreakdownCategory,
  type TokenUsageBreakdownCategoryId,
  type TokenUsageToolBreakdown,
  type ToolSearchMatch,
  type ToolSearchMetadata,
  type ToolSearchTraceEvent,
} from "./token-usage";

// Safe getters: parse untrusted message metadata back into typed values.
// Each getter returns undefined unless every required field is present and well-typed.

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
    excludedRequestOptionChars: readPositiveInteger(breakdown.excludedRequestOptionChars) ?? 0,
    excludedRequestOptionTokens: readPositiveInteger(breakdown.excludedRequestOptionTokens) ?? 0,
    categories,
    tools: Array.isArray(breakdown.tools)
      ? breakdown.tools.map(readToolBreakdown).filter(isDefined)
      : [],
  };
}

export function getToolSearchMetadata(metadata: unknown): ToolSearchMetadata | undefined {
  if (!isRecord(metadata) || !isRecord(metadata.toolSearch)) {
    return undefined;
  }

  const toolSearch = metadata.toolSearch;
  const mode = toolSearch.mode === "all" || toolSearch.mode === "search" ? toolSearch.mode : null;

  if (!mode) {
    return undefined;
  }

  const availableToolCount = readPositiveInteger(toolSearch.availableToolCount);
  const sentToolCount = readPositiveInteger(toolSearch.sentToolCount);
  const deferredToolCount = readPositiveInteger(toolSearch.deferredToolCount);
  const requestCount = readPositiveInteger(toolSearch.requestCount);
  const catalogSchemaTokens = readPositiveInteger(toolSearch.catalogSchemaTokens);
  const sentSchemaTokens = readPositiveInteger(toolSearch.sentSchemaTokens);
  const baselineSchemaTokens = readPositiveInteger(toolSearch.baselineSchemaTokens);
  const savedSchemaTokens = readPositiveInteger(toolSearch.savedSchemaTokens);
  const searchCount = readPositiveInteger(toolSearch.searchCount);
  const describeCount = readPositiveInteger(toolSearch.describeCount);
  const callCount = readPositiveInteger(toolSearch.callCount);

  if (
    availableToolCount == null ||
    sentToolCount == null ||
    deferredToolCount == null ||
    requestCount == null ||
    catalogSchemaTokens == null ||
    sentSchemaTokens == null ||
    baselineSchemaTokens == null ||
    savedSchemaTokens == null ||
    searchCount == null ||
    describeCount == null ||
    callCount == null
  ) {
    return undefined;
  }

  return {
    mode,
    availableToolCount,
    sentToolCount,
    deferredToolCount,
    requestCount,
    catalogSchemaTokens,
    sentSchemaTokens,
    baselineSchemaTokens,
    savedSchemaTokens,
    searchCount,
    describeCount,
    callCount,
    trace: Array.isArray(toolSearch.trace)
      ? toolSearch.trace.map(readToolSearchTraceEvent).filter(isDefined)
      : [],
  };
}

export function getSkillsMetadata(metadata: unknown): SkillsMetadata | undefined {
  if (!isRecord(metadata) || !isRecord(metadata.skills)) {
    return undefined;
  }

  const skills = metadata.skills;
  const enabledSkillCount = readPositiveInteger(skills.enabledSkillCount);
  const metadataTokens = readPositiveInteger(skills.metadataTokens);
  const bodyReadCount = readPositiveInteger(skills.bodyReadCount);
  const activatedBodyTokens = readPositiveInteger(skills.activatedBodyTokens);
  const allBodiesTokens = readPositiveInteger(skills.allBodiesTokens);
  const savedBodyTokens = readPositiveInteger(skills.savedBodyTokens);
  const resourceReadCount = readPositiveInteger(skills.resourceReadCount);
  const activatedResourceTokens = readPositiveInteger(skills.activatedResourceTokens);
  const allResourcesTokens = readPositiveInteger(skills.allResourcesTokens);
  const savedResourceTokens = readPositiveInteger(skills.savedResourceTokens);

  if (
    enabledSkillCount == null ||
    metadataTokens == null ||
    bodyReadCount == null ||
    activatedBodyTokens == null ||
    allBodiesTokens == null ||
    savedBodyTokens == null ||
    resourceReadCount == null ||
    activatedResourceTokens == null ||
    allResourcesTokens == null ||
    savedResourceTokens == null
  ) {
    return undefined;
  }

  return {
    enabledSkillCount,
    metadataTokens,
    bodyReadCount,
    activatedBodyTokens,
    allBodiesTokens,
    savedBodyTokens,
    resourceReadCount,
    activatedResourceTokens,
    allResourcesTokens,
    savedResourceTokens,
    trace: Array.isArray(skills.trace)
      ? skills.trace.map(readSkillReadTraceEvent).filter(isDefined)
      : [],
  };
}

// --- Internals --------------------------------------------------------------

function readTokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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

function readToolBreakdown(value: unknown): TokenUsageToolBreakdown | undefined {
  if (!isRecord(value) || typeof value.name !== "string") {
    return undefined;
  }

  const tokens = readTokenCount(value.tokens);
  const percentage = readTokenCount(value.percentage);
  const chars = readTokenCount(value.chars);

  if (tokens == null || percentage == null || chars == null) {
    return undefined;
  }

  return {
    name: value.name,
    tokens,
    percentage,
    chars,
  };
}

function isBreakdownCategoryId(value: unknown): value is TokenUsageBreakdownCategoryId {
  return value === "systemPrompt" || value === "messages" || value === "tools";
}

function readToolSearchTraceEvent(value: unknown): ToolSearchTraceEvent | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (value.kind === "search") {
    const query = typeof value.query === "string" ? value.query : "";
    const limit = readPositiveInteger(value.limit);
    const totalAvailable = readPositiveInteger(value.totalAvailable);

    if (!query || limit == null || totalAvailable == null) {
      return undefined;
    }

    return {
      kind: "search",
      query,
      limit,
      totalAvailable,
      matches: Array.isArray(value.matches)
        ? value.matches.map(readToolSearchMatch).filter(isDefined)
        : [],
    };
  }

  if (value.kind === "describe") {
    const name = typeof value.name === "string" ? value.name : "";

    if (!name || typeof value.found !== "boolean") {
      return undefined;
    }

    return {
      kind: "describe",
      name,
      found: value.found,
      service: typeof value.service === "string" ? value.service : undefined,
      title: typeof value.title === "string" ? value.title : undefined,
    };
  }

  if (value.kind === "call") {
    const name = typeof value.name === "string" ? value.name : "";

    if (!name || typeof value.found !== "boolean") {
      return undefined;
    }

    return {
      action: typeof value.action === "string" ? value.action : undefined,
      found: value.found,
      kind: "call",
      name,
      service: typeof value.service === "string" ? value.service : undefined,
      title: typeof value.title === "string" ? value.title : undefined,
    };
  }

  return undefined;
}

function readToolSearchMatch(value: unknown): ToolSearchMatch | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = typeof value.name === "string" ? value.name : "";
  const title = typeof value.title === "string" ? value.title : "";
  const service = typeof value.service === "string" ? value.service : "";
  const score = readTokenCount(value.score);

  if (!name || !title || !service || score == null) {
    return undefined;
  }

  return { name, score, service, title };
}

function readSkillReadTraceEvent(value: unknown): SkillReadTraceEvent | undefined {
  if (!isRecord(value) || value.kind !== "skill_read") {
    return undefined;
  }

  const name = typeof value.name === "string" ? value.name : "";

  if (!name || typeof value.found !== "boolean") {
    return undefined;
  }

  return {
    kind: "skill_read",
    name,
    path: typeof value.path === "string" ? value.path : undefined,
    found: value.found,
    chars: readPositiveInteger(value.chars),
  };
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
