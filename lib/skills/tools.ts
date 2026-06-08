import { jsonSchema, type ToolSet, tool } from "ai";

import { getSkillByName, getSkillResource } from "@/lib/skills/skills";

// --- Trace types ------------------------------------------------------------

export type SkillReadTraceEvent = {
  kind: "skill_read";
  name: string;
  path?: string;
  found: boolean;
};

// --- Tool input types -------------------------------------------------------

type SkillReadInput = {
  name: string;
  path?: string;
};

// --- Public API -------------------------------------------------------------

export function createSkillTools(trace: SkillReadTraceEvent[]): ToolSet {
  return {
    skill_read: tool<SkillReadInput, ReturnType<typeof executeSkillRead>>({
      title: "Read a skill",
      description:
        "Read a skill's full instructions by name. When called without a path, returns the skill's markdown body. When called with a path, returns the matching bundled resource (e.g. 'reference.md'). Use this after identifying a relevant skill from the skill list in the system prompt.",
      inputSchema: jsonSchema<SkillReadInput>({
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Exact name of the skill to read.",
          },
          path: {
            type: "string",
            description:
              "Optional relative path of a bundled resource (e.g. 'reference.md'). Omit to read the skill body.",
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

  // No path: return the skill body
  return {
    name,
    found: true,
    body: skill.body,
    description: skill.description,
  };
}
