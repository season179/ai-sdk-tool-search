import { jsonSchema, type ToolSet, tool } from "ai";

import { getSkillByName, getSkillResource, listSkillResources } from "@/lib/skills/skills";
import type { SkillReadTraceEvent } from "@/lib/token-usage";

// --- Re-export for convenience ---------------------------------------------

export type { SkillReadTraceEvent };

// --- Tool input types -------------------------------------------------------

type SkillReadInput = {
  name: string;
  path?: string;
};

// Cap the resource listing returned on activation so a skill with hundreds of
// bundled files can't blow up the tool result; truncation is signalled back to
// the model via `resourcesTruncated`.
const MAX_LISTED_RESOURCES = 50;

// --- Public API -------------------------------------------------------------

/**
 * @param trace      Accumulator the tool pushes a `skill_read` event onto per call.
 * @param skillNames Exact names of the currently-enabled skills. When non-empty
 *                   they constrain the `name` parameter to an enum, so the model
 *                   cannot invoke a hallucinated skill name (spec Step 4 tip).
 */
export function createSkillTools(trace: SkillReadTraceEvent[], skillNames: string[] = []): ToolSet {
  return {
    skill_read: tool<SkillReadInput, ReturnType<typeof executeSkillRead>>({
      title: "Read a skill",
      description:
        "Read a skill's full instructions by name. Called without a path, returns the skill's markdown body plus a listing of any bundled resources (their paths). Called with a path, returns the matching bundled resource (e.g. 'reference.md'). Use this after identifying a relevant skill from the skill list in the system prompt; to read a listed resource, call again with its path.",
      inputSchema: jsonSchema<SkillReadInput>({
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Exact name of the skill to read.",
            ...(skillNames.length > 0 ? { enum: skillNames } : {}),
          },
          path: {
            type: "string",
            description:
              "Optional relative path of a bundled resource (e.g. 'reference.md'), taken from the skill body's resource listing. Omit to read the skill body.",
          },
        },
        required: ["name"],
        additionalProperties: false,
      }),
      async execute(input) {
        const result = await executeSkillRead(input);

        trace.push({
          kind: "skill_read",
          name: result.name,
          path: input.path ?? undefined,
          found: result.found,
          chars: "body" in result && typeof result.body === "string" ? result.body.length : 0,
        });

        return result;
      },
    }),
  };
}

// --- Internals --------------------------------------------------------------

async function executeSkillRead(input: SkillReadInput) {
  const name = String(input.name ?? "").trim();
  const path = input.path?.trim();

  if (!name) {
    return {
      name: "",
      found: false,
      error: "Skill name is required.",
    };
  }

  const skill = await getSkillByName(name);

  if (!skill) {
    return {
      name,
      found: false,
      error: `No skill named '${name}' was found.`,
    };
  }

  // If a path is provided, look up the resource
  if (path) {
    const resource = await getSkillResource(name, path);

    if (!resource) {
      return {
        name,
        path,
        found: false,
        error: `No resource '${path}' found for skill '${name}'.`,
      };
    }

    return {
      name,
      path,
      found: true,
      body: resource.body,
      contentType: resource.contentType,
    };
  }

  // No path: return the skill body plus a listing of bundled resources so the
  // model can discover which paths it may load on demand (tier 3). The bodies
  // are deliberately NOT read here — only paths/contentType — to keep activation
  // cheap. A listing failure must not sink the body read, so degrade to none.
  let resources: Array<{ path: string; contentType: string }> = [];
  let resourcesTruncated = 0;
  try {
    const all = await listSkillResources(name);
    resources = all
      .slice(0, MAX_LISTED_RESOURCES)
      .map((resource) => ({ path: resource.path, contentType: resource.contentType }));
    resourcesTruncated = Math.max(0, all.length - resources.length);
  } catch {
    // Resource listing unavailable — return the body without a listing.
  }

  return {
    name,
    found: true,
    body: skill.body,
    description: skill.description,
    ...(skill.compatibility ? { compatibility: skill.compatibility } : {}),
    ...(resources.length > 0 ? { resources } : {}),
    ...(resourcesTruncated > 0 ? { resourcesTruncated } : {}),
  };
}
