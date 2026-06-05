import { jsonSchema, type ToolSet, tool } from "ai";

type MockToolInput = {
  query?: string;
  limit?: number;
};

type MockToolOutput = {
  toolId: number;
  toolName: string;
  domain: string;
  action: string;
  query: string;
  limit: number;
  items: Array<{
    id: string;
    label: string;
    score: number;
  }>;
};

const DOMAINS = [
  "calendar",
  "email",
  "files",
  "contacts",
  "tasks",
  "notes",
  "metrics",
  "deployments",
  "incidents",
  "knowledge",
] as const;

const ACTIONS = [
  "search",
  "summarize",
  "create",
  "update",
  "delete",
  "list",
  "compare",
  "export",
  "validate",
  "notify",
] as const;

const mockToolInputSchema = jsonSchema<MockToolInput>({
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Optional mock query or instruction for the tool.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: 5,
      description: "Maximum number of mock items to return.",
    },
  },
  additionalProperties: false,
});

function toToolName(domain: string, action: string, index: number) {
  return `mock_${domain}_${action}_${String(index).padStart(3, "0")}`;
}

function buildMockItems({
  action,
  domain,
  limit,
  toolId,
}: {
  action: string;
  domain: string;
  limit: number;
  toolId: number;
}): MockToolOutput["items"] {
  return Array.from({ length: limit }, (_, itemIndex) => ({
    id: `${domain}-${action}-${toolId}-${itemIndex + 1}`,
    label: `Mock ${domain} ${action} result ${itemIndex + 1}`,
    score: Number((1 - itemIndex * 0.07).toFixed(2)),
  }));
}

export const mockTools: ToolSet = Object.fromEntries(
  DOMAINS.flatMap((domain, domainIndex) =>
    ACTIONS.map((action, actionIndex) => {
      const toolId = domainIndex * ACTIONS.length + actionIndex + 1;
      const name = toToolName(domain, action, toolId);

      return [
        name,
        tool<MockToolInput, MockToolOutput>({
          title: `Mock ${domain} ${action}`,
          description: `Deterministic mock tool for ${action} operations in the ${domain} domain.`,
          inputSchema: mockToolInputSchema,
          execute(input) {
            const limit = Math.min(Math.max(input.limit ?? 3, 1), 5);

            return {
              toolId,
              toolName: name,
              domain,
              action,
              query: input.query?.trim() || `mock ${domain} ${action}`,
              limit,
              items: buildMockItems({ action, domain, limit, toolId }),
            };
          },
        }),
      ];
    }),
  ),
);

export const mockToolCount = Object.keys(mockTools).length;
