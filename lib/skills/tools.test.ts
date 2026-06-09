import { afterEach, describe, expect, it, vi } from "vitest";
import type { SkillReadTraceEvent } from "./tools";

// --- Mock getPool for DB function tests ------------------------------------

const mockQuery = vi.fn();

vi.mock("@/lib/scheduler/db", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// Helper to create a skill row
function makeSkillRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "skill-id",
    name: "test-skill",
    description: "A test skill",
    body: "# Test Skill\nInstructions here",
    license: null,
    compatibility: null,
    allowed_tools: null,
    metadata: null,
    version: 1,
    enabled: true,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// Helper to create a resource row
function makeResourceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "resource-id",
    skill_id: "skill-id",
    path: "reference.md",
    content_type: "text/markdown",
    body: "# Reference\nContent here",
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// Helper to call the skill_read execute function from a ToolSet
async function callSkillRead(tools: Record<string, unknown>, input: unknown) {
  const skillRead = tools.skill_read as Record<string, (...args: unknown[]) => Promise<unknown>>;
  return skillRead.execute(input);
}

// --- createSkillTools tests ------------------------------------------------

describe("createSkillTools", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("returns a ToolSet with a skill_read tool", async () => {
    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);

    expect(tools).toHaveProperty("skill_read");
  });

  it("reads a skill body when no path is provided", async () => {
    // No-path reads also enumerate resources, so a second query is issued.
    mockQuery
      .mockResolvedValueOnce({ rows: [makeSkillRow()] }) // getSkillByName
      .mockResolvedValueOnce({ rows: [] }); // listSkillResources (none)

    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);
    const result = await callSkillRead(tools, { name: "test-skill" });

    expect(result).toEqual({
      name: "test-skill",
      found: true,
      body: "# Test Skill\nInstructions here",
      description: "A test skill",
    });
  });

  it("enumerates bundled resource paths (not bodies) when reading a skill body", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeSkillRow()] }) // getSkillByName
      .mockResolvedValueOnce({
        rows: [
          makeResourceRow({ path: "reference.md", content_type: "text/markdown" }),
          makeResourceRow({ id: "r2", path: "data.csv", content_type: "text/csv" }),
        ],
      });

    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);
    const result = (await callSkillRead(tools, { name: "test-skill" })) as Record<string, unknown>;

    expect(result.resources).toEqual([
      { path: "reference.md", contentType: "text/markdown" },
      { path: "data.csv", contentType: "text/csv" },
    ]);
    // The listing exposes paths only — resource bodies are loaded on demand.
    expect(JSON.stringify(result.resources)).not.toContain("Content here");
  });

  it("surfaces compatibility when the skill declares it", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeSkillRow({ compatibility: "Requires Python 3.14+" })] })
      .mockResolvedValueOnce({ rows: [] });

    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);
    const result = (await callSkillRead(tools, { name: "test-skill" })) as Record<string, unknown>;

    expect(result.compatibility).toBe("Requires Python 3.14+");
  });

  it("caps the resource listing and signals truncation", async () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      makeResourceRow({ id: `r${index}`, path: `file-${index}.md` }),
    );
    mockQuery
      .mockResolvedValueOnce({ rows: [makeSkillRow()] })
      .mockResolvedValueOnce({ rows: many });

    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);
    const result = (await callSkillRead(tools, { name: "test-skill" })) as {
      resources: unknown[];
      resourcesTruncated: number;
    };

    expect(result.resources).toHaveLength(50);
    expect(result.resourcesTruncated).toBe(10);
  });

  it("constrains the name parameter to the provided skill names", async () => {
    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace, ["alpha", "beta"]);

    const schema = (
      tools.skill_read as {
        inputSchema: { jsonSchema: { properties: { name: { enum?: string[] } } } };
      }
    ).inputSchema.jsonSchema;

    expect(schema.properties.name.enum).toEqual(["alpha", "beta"]);
  });

  it("omits the name enum when no skill names are provided", async () => {
    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);

    const schema = (
      tools.skill_read as {
        inputSchema: { jsonSchema: { properties: { name: { enum?: string[] } } } };
      }
    ).inputSchema.jsonSchema;

    expect(schema.properties.name.enum).toBeUndefined();
  });

  it("reads a skill resource when path is provided", async () => {
    // First call: getSkillByName, second call: getSkillResource
    mockQuery
      .mockResolvedValueOnce({ rows: [makeSkillRow()] })
      .mockResolvedValueOnce({ rows: [makeResourceRow()] });

    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);
    const result = await callSkillRead(tools, { name: "test-skill", path: "reference.md" });

    expect(result).toEqual({
      name: "test-skill",
      path: "reference.md",
      found: true,
      body: "# Reference\nContent here",
      contentType: "text/markdown",
    });
  });

  it("returns not-found for unknown skill", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);
    const result = await callSkillRead(tools, { name: "nonexistent" });

    expect(result).toEqual({
      name: "nonexistent",
      found: false,
      error: "No skill named 'nonexistent' was found.",
    });
  });

  it("returns not-found for unknown resource path", async () => {
    // Skill exists but resource does not
    mockQuery.mockResolvedValueOnce({ rows: [makeSkillRow()] }).mockResolvedValueOnce({ rows: [] });

    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);
    const result = await callSkillRead(tools, { name: "test-skill", path: "nonexistent.md" });

    expect(result).toEqual({
      name: "test-skill",
      path: "nonexistent.md",
      found: false,
      error: "No resource 'nonexistent.md' found for skill 'test-skill'.",
    });
  });

  it("returns error when name is empty", async () => {
    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);
    const result = await callSkillRead(tools, { name: "" });

    expect(result).toEqual({
      name: "",
      found: false,
      error: "Skill name is required.",
    });
  });

  // --- Trace recording tests ------------------------------------------------

  it("records a trace event on successful skill read", async () => {
    mockQuery.mockResolvedValue({ rows: [makeSkillRow()] });

    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);
    await callSkillRead(tools, { name: "test-skill" });

    expect(trace).toHaveLength(1);
    expect(trace[0]).toEqual({
      kind: "skill_read",
      name: "test-skill",
      path: undefined,
      found: true,
      chars: "# Test Skill\nInstructions here".length,
    });
  });

  it("records a trace event with path when reading a resource", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeSkillRow()] })
      .mockResolvedValueOnce({ rows: [makeResourceRow()] });

    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);
    await callSkillRead(tools, { name: "test-skill", path: "reference.md" });

    expect(trace).toHaveLength(1);
    expect(trace[0]).toEqual({
      kind: "skill_read",
      name: "test-skill",
      path: "reference.md",
      found: true,
      chars: "# Reference\nContent here".length,
    });
  });

  it("records a trace event even when skill is not found", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);
    await callSkillRead(tools, { name: "missing-skill" });

    expect(trace).toHaveLength(1);
    expect(trace[0]).toEqual({
      kind: "skill_read",
      name: "missing-skill",
      path: undefined,
      found: false,
      chars: 0,
    });
  });

  it("accumulates multiple trace events", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeSkillRow()] }) // call 1: getSkillByName
      .mockResolvedValueOnce({ rows: [] }) // call 1: listSkillResources
      .mockResolvedValueOnce({ rows: [] }); // call 2: getSkillByName (not found)

    const { createSkillTools } = await import("./tools");
    const trace: SkillReadTraceEvent[] = [];
    const tools = createSkillTools(trace);

    await callSkillRead(tools, { name: "test-skill" });
    await callSkillRead(tools, { name: "other-skill" });

    expect(trace).toHaveLength(2);
  });
});
