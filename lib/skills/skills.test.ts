import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillsInputError, validateMetadata, validateSkillInput } from "./skills";

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

// --- validateMetadata tests (pure, no mocks needed) ------------------------

describe("validateMetadata", () => {
  it("accepts null and undefined (no metadata)", () => {
    expect(() => validateMetadata(null)).not.toThrow();
    expect(() => validateMetadata(undefined)).not.toThrow();
  });

  it("accepts an empty object", () => {
    expect(() => validateMetadata({})).not.toThrow();
  });

  it("accepts a string-to-string map", () => {
    expect(() => validateMetadata({ author: "example-org", version: "1.0" })).not.toThrow();
  });

  it("throws when a value is not a string", () => {
    expect(() => validateMetadata({ version: 1 })).toThrow(SkillsInputError);
    expect(() => validateMetadata({ nested: { a: "b" } })).toThrow(SkillsInputError);
    expect(() => validateMetadata({ flag: true })).toThrow(SkillsInputError);
  });

  it("throws when metadata is an array", () => {
    expect(() => validateMetadata(["a", "b"])).toThrow(SkillsInputError);
  });

  it("names the offending key in the error message", () => {
    try {
      validateMetadata({ version: 1 });
    } catch (e) {
      expect((e as SkillsInputError).message).toContain("version");
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

// --- Resource row helper ----------------------------------------------------

function makeResourceRow(overrides: Record<string, unknown> = {}): SkillResourceRow {
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

type SkillResourceRow = {
  id: string;
  skill_id: string;
  path: string;
  content_type: string;
  body: string;
  created_at: Date;
  updated_at: Date;
};

// --- validateResourcePath tests ---------------------------------------------

describe("validateResourcePath", () => {
  it("accepts a valid relative path", async () => {
    const { validateResourcePath } = await import("./skills");
    expect(() => validateResourcePath("reference.md")).not.toThrow();
  });

  it("accepts a nested path", async () => {
    const { validateResourcePath } = await import("./skills");
    expect(() => validateResourcePath("docs/reference.md")).not.toThrow();
  });

  it("rejects an empty string", async () => {
    const { validateResourcePath } = await import("./skills");
    expect(() => validateResourcePath("")).toThrow(SkillsInputError);
  });

  it("rejects a leading slash", async () => {
    const { validateResourcePath } = await import("./skills");
    expect(() => validateResourcePath("/reference.md")).toThrow(SkillsInputError);
  });

  it("rejects '..' segments", async () => {
    const { validateResourcePath } = await import("./skills");
    expect(() => validateResourcePath("../etc/passwd")).toThrow(SkillsInputError);
  });

  it("rejects '..' in the middle of path", async () => {
    const { validateResourcePath } = await import("./skills");
    expect(() => validateResourcePath("foo/../bar")).toThrow(SkillsInputError);
  });

  it("includes descriptive message for empty path", async () => {
    const { validateResourcePath } = await import("./skills");
    try {
      validateResourcePath("");
    } catch (e) {
      expect(e).toBeInstanceOf(SkillsInputError);
      expect((e as SkillsInputError).message).toContain("non-empty");
      return;
    }
    expect.unreachable("Should have thrown");
  });

  it("includes descriptive message for leading slash", async () => {
    const { validateResourcePath } = await import("./skills");
    try {
      validateResourcePath("/foo");
    } catch (e) {
      expect(e).toBeInstanceOf(SkillsInputError);
      expect((e as SkillsInputError).message).toContain("/");
      return;
    }
    expect.unreachable("Should have thrown");
  });

  it("includes descriptive message for '..' segments", async () => {
    const { validateResourcePath } = await import("./skills");
    try {
      validateResourcePath("../foo");
    } catch (e) {
      expect(e).toBeInstanceOf(SkillsInputError);
      expect((e as SkillsInputError).message).toContain("..");
      return;
    }
    expect.unreachable("Should have thrown");
  });
});

// --- listSkillResources tests -----------------------------------------------

describe("listSkillResources", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("returns mapped resources from the database", async () => {
    mockQuery.mockResolvedValue({ rows: [makeResourceRow()] });

    const { listSkillResources } = await import("./skills");
    const resources = await listSkillResources("test-skill");

    expect(resources).toHaveLength(1);
    expect(resources[0]).toEqual({
      id: "resource-id",
      skillId: "skill-id",
      path: "reference.md",
      contentType: "text/markdown",
      body: "# Reference\nContent here",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns empty array when no resources exist", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { listSkillResources } = await import("./skills");
    const resources = await listSkillResources("nonexistent");

    expect(resources).toEqual([]);
  });

  it("joins on skill name", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { listSkillResources } = await import("./skills");
    await listSkillResources("my-skill");

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("join agent_skills");
    expect(sql).toContain("s.name");
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ["my-skill"]);
  });

  it("returns resources ordered by path", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { listSkillResources } = await import("./skills");
    await listSkillResources("test-skill");

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("order by r.path");
  });
});

// --- getSkillResource tests -------------------------------------------------

describe("getSkillResource", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("returns a mapped resource when found", async () => {
    mockQuery.mockResolvedValue({ rows: [makeResourceRow()] });

    const { getSkillResource } = await import("./skills");
    const resource = await getSkillResource("test-skill", "reference.md");

    expect(resource).not.toBeNull();
    expect(resource?.path).toBe("reference.md");
    expect(resource?.skillId).toBe("skill-id");
    expect(resource?.body).toBe("# Reference\nContent here");
  });

  it("returns null when no resource matches", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getSkillResource } = await import("./skills");
    const resource = await getSkillResource("test-skill", "nonexistent.md");

    expect(resource).toBeNull();
  });

  it("passes skill name and path as query parameters", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getSkillResource } = await import("./skills");
    await getSkillResource("my-skill", "reference.md");

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ["my-skill", "reference.md"]);
  });

  it("throws SkillsInputError for invalid path", async () => {
    const { getSkillResource } = await import("./skills");
    await expect(getSkillResource("test-skill", "")).rejects.toThrow(SkillsInputError);
  });

  it("throws SkillsInputError for path with leading slash", async () => {
    const { getSkillResource } = await import("./skills");
    await expect(getSkillResource("test-skill", "/foo")).rejects.toThrow(SkillsInputError);
  });

  it("throws SkillsInputError for path with '..' segment", async () => {
    const { getSkillResource } = await import("./skills");
    await expect(getSkillResource("test-skill", "../foo")).rejects.toThrow(SkillsInputError);
  });
});

// --- listAllSkills tests ---------------------------------------------------

describe("listAllSkills", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("returns all skills ordered by name", async () => {
    mockQuery.mockResolvedValue({
      rows: [makeRow({ name: "alpha" }), makeRow({ id: "id2", name: "beta" })],
    });

    const { listAllSkills } = await import("./skills");
    const skills = await listAllSkills();

    expect(skills).toHaveLength(2);
    expect(skills[0].name).toBe("alpha");
    expect(skills[1].name).toBe("beta");
  });

  it("returns empty array when no skills exist", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { listAllSkills } = await import("./skills");
    const skills = await listAllSkills();

    expect(skills).toEqual([]);
  });

  it("includes disabled skills", async () => {
    mockQuery.mockResolvedValue({ rows: [makeRow({ enabled: false })] });

    const { listAllSkills } = await import("./skills");
    const skills = await listAllSkills();

    expect(skills[0].enabled).toBe(false);
  });
});

// --- getSkillById tests ----------------------------------------------------

describe("getSkillById", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("returns a mapped skill when found", async () => {
    mockQuery.mockResolvedValue({ rows: [makeRow()] });

    const { getSkillById } = await import("./skills");
    const skill = await getSkillById("test-id");

    expect(skill.id).toBe("test-id");
    expect(skill.name).toBe("test-skill");
  });

  it("throws SkillNotFoundError when not found", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getSkillById, SkillNotFoundError } = await import("./skills");
    await expect(getSkillById("nonexistent")).rejects.toThrow(SkillNotFoundError);
  });

  it("queries by id", async () => {
    mockQuery.mockResolvedValue({ rows: [makeRow()] });

    const { getSkillById } = await import("./skills");
    await getSkillById("test-id");

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ["test-id"]);
  });
});

// --- createSkill tests -----------------------------------------------------

describe("createSkill", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("creates a skill with valid input", async () => {
    // First call: duplicate check returns empty
    // Second call: insert returns the row
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [makeRow()] });

    const { createSkill } = await import("./skills");
    const skill = await createSkill({
      name: "test-skill",
      description: "A test skill",
    });

    expect(skill.name).toBe("test-skill");
  });

  it("throws SkillsInputError for invalid name", async () => {
    const { createSkill } = await import("./skills");
    await expect(createSkill({ name: "INVALID", description: "A test skill" })).rejects.toThrow(
      SkillsInputError,
    );
  });

  it("throws SkillsInputError for missing description", async () => {
    const { createSkill } = await import("./skills");
    await expect(createSkill({ name: "valid-name", description: "" })).rejects.toThrow(
      SkillsInputError,
    );
  });

  it("throws SkillDuplicateNameError when name exists", async () => {
    // Duplicate check returns existing row
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "existing-id" }] });

    const { createSkill, SkillDuplicateNameError } = await import("./skills");
    await expect(createSkill({ name: "test-skill", description: "A test skill" })).rejects.toThrow(
      SkillDuplicateNameError,
    );
  });

  it("rejects metadata with non-string values before touching the database", async () => {
    const { createSkill } = await import("./skills");
    await expect(
      createSkill({
        name: "test-skill",
        description: "A test skill",
        metadata: { version: 1 } as unknown as Record<string, string>,
      }),
    ).rejects.toThrow(SkillsInputError);

    // Validation runs before any query (no duplicate-check, no insert).
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("accepts a string-to-string metadata map", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeRow({ metadata: { author: "me" } })] });

    const { createSkill } = await import("./skills");
    const skill = await createSkill({
      name: "test-skill",
      description: "A test skill",
      metadata: { author: "me" },
    });

    expect(skill.metadata).toEqual({ author: "me" });
  });

  it("defaults body to empty string", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [makeRow({ body: "" })] });

    const { createSkill } = await import("./skills");
    await createSkill({ name: "test-skill", description: "A test skill" });

    const insertCall = mockQuery.mock.calls[1];
    // body is the 3rd parameter (index 2)
    expect(insertCall[1][2]).toBe("");
  });

  it("defaults enabled to true", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [makeRow()] });

    const { createSkill } = await import("./skills");
    await createSkill({ name: "test-skill", description: "A test skill" });

    const insertCall = mockQuery.mock.calls[1];
    // enabled is the 8th parameter (index 7)
    expect(insertCall[1][7]).toBe(true);
  });

  it("stores SQL NULL (not jsonb 'null') for absent allowed_tools and metadata", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [makeRow()] });

    const { createSkill } = await import("./skills");
    await createSkill({ name: "test-skill", description: "A test skill" });

    const insertCall = mockQuery.mock.calls[1];
    // allowed_tools (index 5) and metadata (index 6) must be JS null so node-pg
    // sends SQL NULL — never the string "null", which becomes jsonb null and
    // violates the agent_skills_metadata_string_map CHECK constraint.
    expect(insertCall[1][5]).toBeNull();
    expect(insertCall[1][6]).toBeNull();
  });
});

// --- updateSkill tests -----------------------------------------------------

describe("updateSkill", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("updates description", async () => {
    // Call 1: getSkillById (verify exists)
    // Call 2: getSkillById (fetch current for validation)
    // Call 3: update returning
    mockQuery
      .mockResolvedValueOnce({ rows: [makeRow()] })
      .mockResolvedValueOnce({ rows: [makeRow()] })
      .mockResolvedValueOnce({ rows: [makeRow({ description: "Updated" })] });

    const { updateSkill } = await import("./skills");
    const skill = await updateSkill("test-id", { description: "Updated" });

    expect(skill.description).toBe("Updated");
  });

  it("throws SkillNotFoundError when skill does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { updateSkill, SkillNotFoundError } = await import("./skills");
    await expect(updateSkill("nonexistent", { description: "x" })).rejects.toThrow(
      SkillNotFoundError,
    );
  });

  it("validates new description", async () => {
    // First getSkillById returns existing skill
    mockQuery.mockResolvedValueOnce({ rows: [makeRow()] });
    // Second getSkillById returns same
    mockQuery.mockResolvedValueOnce({ rows: [makeRow()] });

    const { updateSkill } = await import("./skills");
    await expect(updateSkill("test-id", { description: "" })).rejects.toThrow(SkillsInputError);
  });

  it("returns skill unchanged when no fields provided", async () => {
    // getSkillById calls
    mockQuery
      .mockResolvedValueOnce({ rows: [makeRow()] })
      .mockResolvedValueOnce({ rows: [makeRow()] });

    const { updateSkill } = await import("./skills");
    const skill = await updateSkill("test-id", {});

    expect(skill.id).toBe("test-id");
    // Should only call getSkillById twice, no update query
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("updates enabled field", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeRow()] })
      .mockResolvedValueOnce({ rows: [makeRow({ enabled: false })] });

    const { updateSkill } = await import("./skills");
    const skill = await updateSkill("test-id", { enabled: false });

    expect(skill.enabled).toBe(false);
  });
});

// --- deleteSkill tests -----------------------------------------------------

describe("deleteSkill", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("deletes a skill and returns it", async () => {
    // Call 1: getSkillById
    // Call 2: delete
    mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }).mockResolvedValueOnce({ rows: [] });

    const { deleteSkill } = await import("./skills");
    const skill = await deleteSkill("test-id");

    expect(skill.id).toBe("test-id");
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("throws SkillNotFoundError when skill does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { deleteSkill, SkillNotFoundError } = await import("./skills");
    await expect(deleteSkill("nonexistent")).rejects.toThrow(SkillNotFoundError);
  });

  it("calls delete with correct id", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeRow()] }).mockResolvedValueOnce({ rows: [] });

    const { deleteSkill } = await import("./skills");
    await deleteSkill("test-id");

    const deleteCall = mockQuery.mock.calls[1];
    expect(deleteCall[0]).toContain("delete from agent_skills");
    expect(deleteCall[1]).toEqual(["test-id"]);
  });
});

// --- listSkillResourcesBySkillId tests --------------------------------------

describe("listSkillResourcesBySkillId", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("returns mapped resources from the database", async () => {
    mockQuery.mockResolvedValue({ rows: [makeResourceRow()] });

    const { listSkillResourcesBySkillId } = await import("./skills");
    const resources = await listSkillResourcesBySkillId("skill-id");

    expect(resources).toHaveLength(1);
    expect(resources[0]).toEqual({
      id: "resource-id",
      skillId: "skill-id",
      path: "reference.md",
      contentType: "text/markdown",
      body: "# Reference\nContent here",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns empty array when no resources exist", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { listSkillResourcesBySkillId } = await import("./skills");
    const resources = await listSkillResourcesBySkillId("nonexistent");

    expect(resources).toEqual([]);
  });

  it("queries by skill id ordered by path", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { listSkillResourcesBySkillId } = await import("./skills");
    await listSkillResourcesBySkillId("skill-id");

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("where skill_id = $1");
    expect(sql).toContain("order by path");
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ["skill-id"]);
  });
});

// --- getSkillResourceById tests ---------------------------------------------

describe("getSkillResourceById", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("returns a mapped resource when found", async () => {
    mockQuery.mockResolvedValue({ rows: [makeResourceRow()] });

    const { getSkillResourceById } = await import("./skills");
    const resource = await getSkillResourceById("resource-id");

    expect(resource.id).toBe("resource-id");
    expect(resource.path).toBe("reference.md");
    expect(resource.skillId).toBe("skill-id");
  });

  it("throws SkillResourceNotFoundError when not found", async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    const { getSkillResourceById, SkillResourceNotFoundError } = await import("./skills");
    await expect(getSkillResourceById("nonexistent")).rejects.toThrow(SkillResourceNotFoundError);
  });

  it("queries by id", async () => {
    mockQuery.mockResolvedValue({ rows: [makeResourceRow()] });

    const { getSkillResourceById } = await import("./skills");
    await getSkillResourceById("resource-id");

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ["resource-id"]);
  });
});

// --- createSkillResource tests ----------------------------------------------

// A node-pg error carries a SQLSTATE `code`; helper to fake one.
function pgError(code: string): Error {
  return Object.assign(new Error(`pg error ${code}`), { code });
}

describe("createSkillResource", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("creates a resource with a single atomic insert", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeResourceRow()] });

    const { createSkillResource } = await import("./skills");
    const resource = await createSkillResource({ skillId: "skill-id", path: "reference.md" });

    expect(resource.path).toBe("reference.md");
    expect(resource.skillId).toBe("skill-id");
    // No pre-check round trips — just the insert.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("throws SkillsInputError for invalid path before touching the db", async () => {
    const { createSkillResource } = await import("./skills");
    await expect(createSkillResource({ skillId: "skill-id", path: "../escape" })).rejects.toThrow(
      SkillsInputError,
    );
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("throws SkillsInputError for empty path", async () => {
    const { createSkillResource } = await import("./skills");
    await expect(createSkillResource({ skillId: "skill-id", path: "" })).rejects.toThrow(
      SkillsInputError,
    );
  });

  it("throws SkillsInputError for a non-string body before touching the db", async () => {
    const { createSkillResource } = await import("./skills");
    await expect(
      // @ts-expect-error — exercising the runtime type guard
      createSkillResource({ skillId: "skill-id", path: "reference.md", body: 123 }),
    ).rejects.toThrow(SkillsInputError);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("maps a foreign-key violation (missing skill) to SkillNotFoundError", async () => {
    mockQuery.mockRejectedValueOnce(pgError("23503"));

    const { createSkillResource, SkillNotFoundError } = await import("./skills");
    await expect(
      createSkillResource({ skillId: "nonexistent", path: "reference.md" }),
    ).rejects.toThrow(SkillNotFoundError);
  });

  it("maps a unique violation to SkillResourceDuplicatePathError", async () => {
    mockQuery.mockRejectedValueOnce(pgError("23505"));

    const { createSkillResource, SkillResourceDuplicatePathError } = await import("./skills");
    await expect(
      createSkillResource({ skillId: "skill-id", path: "reference.md" }),
    ).rejects.toThrow(SkillResourceDuplicatePathError);
  });

  it("rethrows unrelated db errors untouched", async () => {
    mockQuery.mockRejectedValueOnce(pgError("08006")); // connection failure

    const { createSkillResource } = await import("./skills");
    await expect(
      createSkillResource({ skillId: "skill-id", path: "reference.md" }),
    ).rejects.toMatchObject({ code: "08006" });
  });

  it("defaults contentType to text/markdown and body to empty string", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeResourceRow()] });

    const { createSkillResource } = await import("./skills");
    await createSkillResource({ skillId: "skill-id", path: "reference.md" });

    const insertCall = mockQuery.mock.calls[0];
    // params: [skillId, path, contentType, body]
    expect(insertCall[1][2]).toBe("text/markdown");
    expect(insertCall[1][3]).toBe("");
  });
});

// --- updateSkillResource tests ----------------------------------------------

describe("updateSkillResource", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("updates the body via lookup + update", async () => {
    // Call 1: getSkillResourceById
    // Call 2: update returning
    mockQuery
      .mockResolvedValueOnce({ rows: [makeResourceRow()] })
      .mockResolvedValueOnce({ rows: [makeResourceRow({ body: "Updated" })] });

    const { updateSkillResource } = await import("./skills");
    const resource = await updateSkillResource("skill-id", "resource-id", { body: "Updated" });

    expect(resource.body).toBe("Updated");
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("throws SkillResourceNotFoundError when the resource does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { updateSkillResource, SkillResourceNotFoundError } = await import("./skills");
    await expect(updateSkillResource("skill-id", "nonexistent", { body: "x" })).rejects.toThrow(
      SkillResourceNotFoundError,
    );
  });

  it("throws SkillResourceNotFoundError when the resource belongs to another skill", async () => {
    // Resource exists but its skill_id ('skill-id') does not match the URL's skill id.
    mockQuery.mockResolvedValueOnce({ rows: [makeResourceRow()] });

    const { updateSkillResource, SkillResourceNotFoundError } = await import("./skills");
    await expect(updateSkillResource("other-skill", "resource-id", { body: "x" })).rejects.toThrow(
      SkillResourceNotFoundError,
    );
    // Lookup only — never reaches the update.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("throws SkillsInputError for an invalid new path", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeResourceRow()] });

    const { updateSkillResource } = await import("./skills");
    await expect(updateSkillResource("skill-id", "resource-id", { path: "/bad" })).rejects.toThrow(
      SkillsInputError,
    );
  });

  it("maps a unique violation on rename to SkillResourceDuplicatePathError", async () => {
    // Call 1: getSkillResourceById; Call 2: update rejects with a unique violation.
    mockQuery
      .mockResolvedValueOnce({ rows: [makeResourceRow()] })
      .mockRejectedValueOnce(pgError("23505"));

    const { updateSkillResource, SkillResourceDuplicatePathError } = await import("./skills");
    await expect(
      updateSkillResource("skill-id", "resource-id", { path: "new.md" }),
    ).rejects.toThrow(SkillResourceDuplicatePathError);
  });

  it("performs a path rename with no separate pre-check query", async () => {
    // Lookup + update only — the unique constraint is enforced by the db, not a SELECT.
    mockQuery
      .mockResolvedValueOnce({ rows: [makeResourceRow()] })
      .mockResolvedValueOnce({ rows: [makeResourceRow({ path: "new.md" })] });

    const { updateSkillResource } = await import("./skills");
    await updateSkillResource("skill-id", "resource-id", { path: "new.md" });

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("returns the resource unchanged when no fields provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeResourceRow()] });

    const { updateSkillResource } = await import("./skills");
    const resource = await updateSkillResource("skill-id", "resource-id", {});

    expect(resource.id).toBe("resource-id");
    // Only getSkillResourceById runs; no update query.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

// --- deleteSkillResource tests ----------------------------------------------

describe("deleteSkillResource", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("deletes a resource and returns it", async () => {
    // Call 1: getSkillResourceById
    // Call 2: delete
    mockQuery
      .mockResolvedValueOnce({ rows: [makeResourceRow()] })
      .mockResolvedValueOnce({ rows: [] });

    const { deleteSkillResource } = await import("./skills");
    const resource = await deleteSkillResource("skill-id", "resource-id");

    expect(resource.id).toBe("resource-id");
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("throws SkillResourceNotFoundError when the resource does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { deleteSkillResource, SkillResourceNotFoundError } = await import("./skills");
    await expect(deleteSkillResource("skill-id", "nonexistent")).rejects.toThrow(
      SkillResourceNotFoundError,
    );
  });

  it("throws SkillResourceNotFoundError when the resource belongs to another skill", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [makeResourceRow()] });

    const { deleteSkillResource, SkillResourceNotFoundError } = await import("./skills");
    await expect(deleteSkillResource("other-skill", "resource-id")).rejects.toThrow(
      SkillResourceNotFoundError,
    );
    // Lookup only — never reaches the delete.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("calls delete with the correct id", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeResourceRow()] })
      .mockResolvedValueOnce({ rows: [] });

    const { deleteSkillResource } = await import("./skills");
    await deleteSkillResource("skill-id", "resource-id");

    const deleteCall = mockQuery.mock.calls[1];
    expect(deleteCall[0]).toContain("delete from agent_skill_resources");
    expect(deleteCall[1]).toEqual(["resource-id"]);
  });
});
