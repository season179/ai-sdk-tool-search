import { describe, expect, it } from "vitest";
import type { SkillReadTraceEvent, SkillsMetadata } from "./token-usage";
import { getSkillsMetadata } from "./token-usage-getters";

// --- buildSkillsMetadata tests (imported from tool-search) -----------------

describe("buildSkillsMetadata", () => {
  it("returns zero metrics when no skills are enabled", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");

    const result = buildSkillsMetadata({
      enabledSkills: [],
      skillTrace: [],
    });

    expect(result.enabledSkillCount).toBe(0);
    expect(result.metadataTokens).toBe(0);
    expect(result.bodyReadCount).toBe(0);
    expect(result.activatedBodyTokens).toBe(0);
    expect(result.allBodiesTokens).toBe(0);
    expect(result.savedBodyTokens).toBe(0);
    expect(result.resourceReadCount).toBe(0);
    expect(result.activatedResourceTokens).toBe(0);
    expect(result.allResourcesTokens).toBe(0);
    expect(result.savedResourceTokens).toBe(0);
    expect(result.trace).toEqual([]);
  });

  it("computes metadata tokens from the injected catalog string", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");
    const { buildSkillsCatalog } = await import("./skills/catalog");

    const skill = { name: "my-skill", description: "A test skill", body: "body content" };
    const result = buildSkillsMetadata({ enabledSkills: [skill], skillTrace: [] });

    // Tier-1 cost measures the exact catalog text (boilerplate + per-skill line),
    // not just raw name+description, so it matches what the route injects.
    const expectedChars = buildSkillsCatalog([skill]).length;
    expect(result.metadataTokens).toBe(Math.max(1, Math.round(expectedChars / 4)));
  });

  it("computes all-bodies baseline from skill bodies", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");

    const body = "# Instructions\nDo the thing.";
    const result = buildSkillsMetadata({
      enabledSkills: [{ name: "skill-a", description: "desc", body }],
      skillTrace: [],
    });

    // allBodiesTokens = estimateTokensFromChars(body.length)
    expect(result.allBodiesTokens).toBe(Math.max(1, Math.round(body.length / 4)));
    expect(result.activatedBodyTokens).toBe(0);
    expect(result.savedBodyTokens).toBe(result.allBodiesTokens);
  });

  it("computes activated body tokens from body reads", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");

    const bodyA = "A".repeat(100);
    const bodyB = "B".repeat(200);
    const result = buildSkillsMetadata({
      enabledSkills: [
        { name: "skill-a", description: "desc a", body: bodyA },
        { name: "skill-b", description: "desc b", body: bodyB },
      ],
      skillTrace: [{ kind: "skill_read", name: "skill-a", found: true }],
    });

    expect(result.bodyReadCount).toBe(1);
    expect(result.activatedBodyTokens).toBe(Math.max(1, Math.round(100 / 4)));
    expect(result.allBodiesTokens).toBe(Math.max(1, Math.round(300 / 4)));
    expect(result.savedBodyTokens).toBe(result.allBodiesTokens - result.activatedBodyTokens);
  });

  it("counts resource reads from trace events with path", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");

    const result = buildSkillsMetadata({
      enabledSkills: [{ name: "skill-a", description: "desc", body: "body" }],
      skillTrace: [
        { kind: "skill_read", name: "skill-a", found: true },
        { kind: "skill_read", name: "skill-a", path: "reference.md", found: true },
        { kind: "skill_read", name: "skill-a", path: "guide.md", found: true },
      ],
    });

    expect(result.bodyReadCount).toBe(1);
    expect(result.resourceReadCount).toBe(2);
  });

  it("ignores not-found trace events", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");

    const result = buildSkillsMetadata({
      enabledSkills: [{ name: "skill-a", description: "desc", body: "body content here" }],
      skillTrace: [
        { kind: "skill_read", name: "skill-a", found: false },
        { kind: "skill_read", name: "skill-a", path: "ref.md", found: false },
      ],
    });

    expect(result.bodyReadCount).toBe(0);
    expect(result.resourceReadCount).toBe(0);
    expect(result.activatedBodyTokens).toBe(0);
  });

  it("handles multiple enabled skills with mixed reads", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");

    const result = buildSkillsMetadata({
      enabledSkills: [
        { name: "a", description: "d", body: "AAA" },
        { name: "b", description: "d", body: "BBBB" },
        { name: "c", description: "d", body: "CCCCC" },
      ],
      skillTrace: [
        { kind: "skill_read", name: "a", found: true },
        { kind: "skill_read", name: "c", path: "ref.md", found: true },
      ],
    });

    expect(result.enabledSkillCount).toBe(3);
    expect(result.bodyReadCount).toBe(1); // only "a" (no path)
    expect(result.resourceReadCount).toBe(1); // only "c" (with path)
    // activatedBodyTokens: only skill "a" body = 3 chars
    expect(result.activatedBodyTokens).toBe(Math.max(1, Math.round(3 / 4)));
  });

  it("passes trace through to result", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");

    const trace: SkillReadTraceEvent[] = [{ kind: "skill_read", name: "a", found: true }];
    const result = buildSkillsMetadata({
      enabledSkills: [],
      skillTrace: trace,
    });

    expect(result.trace).toBe(trace);
  });

  it("uses provided allResourcesChars for resource baseline", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");

    const result = buildSkillsMetadata({
      enabledSkills: [{ name: "a", description: "d", body: "body" }],
      skillTrace: [{ kind: "skill_read", name: "a", path: "ref.md", found: true }],
      allResourcesChars: 400,
    });

    expect(result.allResourcesTokens).toBe(Math.max(1, Math.round(400 / 4)));
    expect(result.resourceReadCount).toBe(1);
    // activatedResourceTokens is 0 since the trace carries no resource char counts
    expect(result.activatedResourceTokens).toBe(0);
    expect(result.savedResourceTokens).toBe(result.allResourcesTokens);
  });

  it("derives activated resource tokens from trace char counts", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");

    const result = buildSkillsMetadata({
      enabledSkills: [{ name: "a", description: "d", body: "body" }],
      skillTrace: [
        { kind: "skill_read", name: "a", path: "ref.md", found: true, chars: 120 },
        { kind: "skill_read", name: "a", path: "guide.md", found: true, chars: 80 },
      ],
      allResourcesChars: 400,
    });

    // activated = 120 + 80 = 200 chars
    expect(result.resourceReadCount).toBe(2);
    expect(result.activatedResourceTokens).toBe(Math.max(1, Math.round(200 / 4)));
    expect(result.savedResourceTokens).toBe(
      result.allResourcesTokens - result.activatedResourceTokens,
    );
  });

  it("dedupes repeated resource reads by name + path", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");

    const result = buildSkillsMetadata({
      enabledSkills: [{ name: "a", description: "d", body: "body" }],
      skillTrace: [
        { kind: "skill_read", name: "a", path: "ref.md", found: true, chars: 100 },
        { kind: "skill_read", name: "a", path: "ref.md", found: true, chars: 100 },
      ],
      allResourcesChars: 400,
    });

    // Both reads target the same resource; counted once toward activated chars.
    expect(result.resourceReadCount).toBe(2);
    expect(result.activatedResourceTokens).toBe(Math.max(1, Math.round(100 / 4)));
  });

  it("prefers explicit activatedResourceChars over trace-derived chars", async () => {
    const { buildSkillsMetadata } = await import("./tool-search");

    const result = buildSkillsMetadata({
      enabledSkills: [{ name: "a", description: "d", body: "body" }],
      skillTrace: [{ kind: "skill_read", name: "a", path: "ref.md", found: true, chars: 100 }],
      allResourcesChars: 400,
      activatedResourceChars: 40,
    });

    expect(result.activatedResourceTokens).toBe(Math.max(1, Math.round(40 / 4)));
  });
});

// --- getSkillsMetadata safe getter tests ------------------------------------

describe("getSkillsMetadata", () => {
  const validMetadata: SkillsMetadata = {
    enabledSkillCount: 2,
    metadataTokens: 50,
    bodyReadCount: 1,
    activatedBodyTokens: 100,
    allBodiesTokens: 500,
    savedBodyTokens: 400,
    resourceReadCount: 0,
    activatedResourceTokens: 0,
    allResourcesTokens: 0,
    savedResourceTokens: 0,
    trace: [],
  };

  it("returns undefined for null input", () => {
    expect(getSkillsMetadata(null)).toBeUndefined();
  });

  it("returns undefined when skills field is missing", () => {
    expect(getSkillsMetadata({})).toBeUndefined();
  });

  it("returns undefined when skills is null", () => {
    expect(getSkillsMetadata({ skills: null })).toBeUndefined();
  });

  it("returns undefined when a required field is missing", () => {
    const { enabledSkillCount: _, ...withoutCount } = validMetadata;
    expect(getSkillsMetadata({ skills: withoutCount })).toBeUndefined();
  });

  it("returns undefined when a field has wrong type", () => {
    expect(
      getSkillsMetadata({ skills: { ...validMetadata, enabledSkillCount: "two" } }),
    ).toBeUndefined();
  });

  it("parses valid metadata correctly", () => {
    const result = getSkillsMetadata({ skills: validMetadata });
    expect(result).toEqual(validMetadata);
  });

  it("parses metadata with trace events", () => {
    const withTrace: SkillsMetadata = {
      ...validMetadata,
      trace: [
        { kind: "skill_read", name: "my-skill", found: true },
        { kind: "skill_read", name: "my-skill", path: "ref.md", found: true },
      ],
    };

    const result = getSkillsMetadata({ skills: withTrace });
    expect(result).toEqual(withTrace);
  });

  it("filters out invalid trace events", () => {
    const withBadTrace = {
      ...validMetadata,
      trace: [
        { kind: "skill_read", name: "good", found: true },
        { kind: "other", name: "bad" },
        { kind: "skill_read", found: true }, // missing name
      ],
    };

    const result = getSkillsMetadata({ skills: withBadTrace });
    expect(result?.trace).toHaveLength(1);
    expect(result?.trace[0].name).toBe("good");
  });

  it("handles non-array trace gracefully", () => {
    const withBadTrace = {
      ...validMetadata,
      trace: "not an array",
    };

    const result = getSkillsMetadata({ skills: withBadTrace });
    expect(result?.trace).toEqual([]);
  });
});
