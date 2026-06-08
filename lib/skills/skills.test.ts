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
