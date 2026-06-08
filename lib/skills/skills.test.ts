import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillsInputError, validateSkillInput } from "./skills";

// --- Mock getPool for DB function tests ------------------------------------

const mockQuery = vi.fn();

vi.mock("@/lib/scheduler/db", () => ({
  getPool: () => ({ query: mockQuery }),
}));

// Import DB-dependent functions after mock is set up
// We use dynamic imports inside tests to ensure the mock is active

// Helper to create a realistic DB row
function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-id",
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

// --- validateSkillInput tests (pure, no mocks needed) ----------------------

describe("validateSkillInput", () => {
  it("accepts valid input", () => {
    expect(() =>
      validateSkillInput({ name: "my-skill", description: "A test skill" }),
    ).not.toThrow();
  });

  it("accepts input with optional compatibility", () => {
    expect(() =>
      validateSkillInput({
        name: "my-skill",
        description: "A test skill",
        compatibility: "node>=18",
      }),
    ).not.toThrow();
  });

  it("accepts null compatibility", () => {
    expect(() =>
      validateSkillInput({
        name: "my-skill",
        description: "A test skill",
        compatibility: null,
      }),
    ).not.toThrow();
  });

  // --- name validation ---

  it("throws when name is missing", () => {
    expect(() => validateSkillInput({ description: "A test skill" })).toThrow(SkillsInputError);
  });

  it("throws when name is empty string", () => {
    expect(() => validateSkillInput({ name: "", description: "A test skill" })).toThrow(
      SkillsInputError,
    );
  });

  it("throws when name is whitespace only", () => {
    expect(() => validateSkillInput({ name: "  ", description: "A test skill" })).toThrow(
      SkillsInputError,
    );
  });

  it("throws when name exceeds 64 characters", () => {
    const longName = "a".repeat(65);
    expect(() => validateSkillInput({ name: longName, description: "A test skill" })).toThrow(
      SkillsInputError,
    );
  });

  it("accepts a 64-character name", () => {
    const name = "a".repeat(64);
    expect(() => validateSkillInput({ name, description: "A test skill" })).not.toThrow();
  });

  it("throws when name has uppercase letters", () => {
    expect(() => validateSkillInput({ name: "MySkill", description: "A test skill" })).toThrow(
      SkillsInputError,
    );
  });

  it("throws when name has spaces", () => {
    expect(() => validateSkillInput({ name: "my skill", description: "A test skill" })).toThrow(
      SkillsInputError,
    );
  });

  it("throws when name has underscores", () => {
    expect(() => validateSkillInput({ name: "my_skill", description: "A test skill" })).toThrow(
      SkillsInputError,
    );
  });

  it("throws when name starts with a hyphen", () => {
    expect(() => validateSkillInput({ name: "-skill", description: "A test skill" })).toThrow(
      SkillsInputError,
    );
  });

  it("throws when name has consecutive hyphens", () => {
    expect(() => validateSkillInput({ name: "my--skill", description: "A test skill" })).toThrow(
      SkillsInputError,
    );
  });

  it("accepts single alphanumeric name", () => {
    expect(() =>
      validateSkillInput({ name: "skill123", description: "A test skill" }),
    ).not.toThrow();
  });

  it("accepts hyphenated name", () => {
    expect(() =>
      validateSkillInput({ name: "my-awesome-skill", description: "A test skill" }),
    ).not.toThrow();
  });

  // --- description validation ---

  it("throws when description is missing", () => {
    expect(() => validateSkillInput({ name: "my-skill" })).toThrow(SkillsInputError);
  });

  it("throws when description is empty", () => {
    expect(() => validateSkillInput({ name: "my-skill", description: "" })).toThrow(
      SkillsInputError,
    );
  });

  it("throws when description is whitespace only", () => {
    expect(() => validateSkillInput({ name: "my-skill", description: "   " })).toThrow(
      SkillsInputError,
    );
  });

  it("throws when description exceeds 1024 characters", () => {
    const longDesc = "x".repeat(1025);
    expect(() => validateSkillInput({ name: "my-skill", description: longDesc })).toThrow(
      SkillsInputError,
    );
  });

  it("accepts a 1024-character description", () => {
    const desc = "x".repeat(1024);
    expect(() => validateSkillInput({ name: "my-skill", description: desc })).not.toThrow();
  });

  // --- compatibility validation ---

  it("throws when compatibility exceeds 500 characters", () => {
    const longCompat = "c".repeat(501);
    expect(() =>
      validateSkillInput({
        name: "my-skill",
        description: "A test skill",
        compatibility: longCompat,
      }),
    ).toThrow(SkillsInputError);
  });

  it("accepts a 500-character compatibility", () => {
    const compat = "c".repeat(500);
    expect(() =>
      validateSkillInput({
        name: "my-skill",
        description: "A test skill",
        compatibility: compat,
      }),
    ).not.toThrow();
  });

  it("throws when compatibility is a non-string type", () => {
    expect(() =>
      validateSkillInput({
        name: "my-skill",
        description: "A test skill",
        compatibility: 123,
      }),
    ).toThrow(SkillsInputError);
  });

  // --- error message quality ---

  it("includes descriptive message for missing name", () => {
    try {
      validateSkillInput({ description: "A test skill" });
    } catch (e) {
      expect(e).toBeInstanceOf(SkillsInputError);
      expect((e as SkillsInputError).message).toContain("name");
      return;
    }
    expect.unreachable("Should have thrown");
  });

  it("includes descriptive message for invalid name pattern", () => {
    try {
      validateSkillInput({ name: "INVALID", description: "A test skill" });
    } catch (e) {
      expect(e).toBeInstanceOf(SkillsInputError);
      expect((e as SkillsInputError).message).toContain("^[a-z0-9]+(-[a-z0-9]+)*$");
      return;
    }
    expect.unreachable("Should have thrown");
  });
});

// --- listEnabledSkills tests ------------------------------------------------

describe("listEnabledSkills", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("returns mapped skills from the database", async () => {
    mockQuery.mockResolvedValue({ rows: [makeRow()] });

    const { listEnabledSkills } = await import("./skills");
    const skills = await listEnabledSkills();

    expect(skills).toHaveLength(1);
    expect(skills[0]).toEqual({
      id: "test-id",
      name: "test-skill",
      description: "A test skill",
      body: "# Test Skill\nInstructions here",
      license: null,
      compatibility: null,
      allowedTools: null,
      metadata: null,
      version: 1,
      enabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns empty array when no enabled skills exist", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { listEnabledSkills } = await import("./skills");
    const skills = await listEnabledSkills();

    expect(skills).toEqual([]);
  });

  it("maps allowed_tools jsonb array to allowedTools", async () => {
    mockQuery.mockResolvedValue({
      rows: [makeRow({ allowed_tools: ["tool-a", "tool-b"] })],
    });

    const { listEnabledSkills } = await import("./skills");
    const skills = await listEnabledSkills();

    expect(skills[0].allowedTools).toEqual(["tool-a", "tool-b"]);
  });

  it("maps metadata jsonb object correctly", async () => {
    mockQuery.mockResolvedValue({
      rows: [makeRow({ metadata: { author: "test", version: "2" } })],
    });

    const { listEnabledSkills } = await import("./skills");
    const skills = await listEnabledSkills();

    expect(skills[0].metadata).toEqual({ author: "test", version: "2" });
  });

  it("returns null for allowedTools when db value is not an array", async () => {
    mockQuery.mockResolvedValue({
      rows: [makeRow({ allowed_tools: "not-an-array" })],
    });

    const { listEnabledSkills } = await import("./skills");
    const skills = await listEnabledSkills();

    expect(skills[0].allowedTools).toBeNull();
  });

  it("returns null for metadata when db value is not an object", async () => {
    mockQuery.mockResolvedValue({
      rows: [makeRow({ metadata: "not-an-object" })],
    });

    const { listEnabledSkills } = await import("./skills");
    const skills = await listEnabledSkills();

    expect(skills[0].metadata).toBeNull();
  });

  it("queries only enabled skills", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { listEnabledSkills } = await import("./skills");
    await listEnabledSkills();

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("where enabled = true");
  });
});

// --- getSkillByName tests ---------------------------------------------------

describe("getSkillByName", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("returns a mapped skill when found", async () => {
    mockQuery.mockResolvedValue({ rows: [makeRow()] });

    const { getSkillByName } = await import("./skills");
    const skill = await getSkillByName("test-skill");

    expect(skill).not.toBeNull();
    expect(skill?.name).toBe("test-skill");
    expect(skill?.id).toBe("test-id");
  });

  it("returns null when no skill matches", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getSkillByName } = await import("./skills");
    const skill = await getSkillByName("nonexistent");

    expect(skill).toBeNull();
  });

  it("passes the name as a query parameter", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getSkillByName } = await import("./skills");
    await getSkillByName("my-skill");

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ["my-skill"]);
  });

  it("returns disabled skills (no enabled filter)", async () => {
    mockQuery.mockResolvedValue({ rows: [makeRow({ enabled: false })] });

    const { getSkillByName } = await import("./skills");
    const skill = await getSkillByName("test-skill");

    expect(skill).not.toBeNull();
    expect(skill?.enabled).toBe(false);
  });
});
