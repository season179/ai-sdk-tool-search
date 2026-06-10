import {
  DEFAULT_AGENT_ID,
  getReferenceById,
  getSkillById,
  listSkillCatalogEntries,
} from "@/lib/skills/skills";

/**
 * Progressive-disclosure helpers per the Agent Skills client guide
 * (agentskills.io/client-implementation/adding-skills-support).
 *
 * Filesystem skills link the three tiers together by file path: the catalog
 * points at SKILL.md, and instructions reference bundled files by relative
 * path. Our skills live in Postgres, so the row *id* plays the role of the
 * path at every tier:
 *
 *   tier 1 — catalog:    name + description + skill id (instead of location)
 *   tier 2 — activation: load instructions by skill id
 *   tier 3 — resources:  load reference content by reference id
 */

export type SkillCatalogEntry = {
  id: string;
  name: string;
  description: string;
};

/** Tier 1: enabled skills only. Disabling a skill hides it here and blocks activation. */
export async function getSkillCatalog(
  agentId: string = DEFAULT_AGENT_ID,
): Promise<SkillCatalogEntry[]> {
  return listSkillCatalogEntries(agentId);
}

/** Renders the tier-1 catalog block for a system prompt or tool description. */
export function formatSkillCatalog(entries: SkillCatalogEntry[]) {
  if (entries.length === 0) {
    return "";
  }

  const items = entries
    .map(
      (entry) =>
        `  <skill>\n    <id>${entry.id}</id>\n    <name>${escapeXml(entry.name)}</name>\n    <description>${escapeXml(entry.description)}</description>\n  </skill>`,
    )
    .join("\n");

  return `<available_skills>\n${items}\n</available_skills>`;
}

/**
 * Tier 2: full instructions for an activated skill, with its references
 * listed (id + name + description) but not eagerly loaded.
 */
export async function activateSkill(skillId: string, agentId: string = DEFAULT_AGENT_ID) {
  const skill = await getSkillById(skillId, agentId);

  if (!skill?.isEnabled) {
    return null;
  }

  const referenceList =
    skill.references.length === 0
      ? ""
      : `\n\n<skill_references>\n${skill.references
          .map(
            (reference) =>
              `  <reference id="${reference.id}" name="${escapeXml(reference.name)}">${escapeXml(reference.description)}</reference>`,
          )
          .join(
            "\n",
          )}\n</skill_references>\nLoad a reference by its id when the instructions call for it.`;

  return `<skill_content name="${escapeXml(skill.name)}" id="${skill.id}">\n${skill.body}${referenceList}\n</skill_content>`;
}

/** Tier 3: a single reference document, loaded on demand by id. */
export async function loadSkillReference(referenceId: string, agentId: string = DEFAULT_AGENT_ID) {
  const reference = await getReferenceById(referenceId, agentId);

  if (!reference) {
    return null;
  }

  return `<reference_content name="${escapeXml(reference.name)}" id="${reference.id}">\n${reference.body}\n</reference_content>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
