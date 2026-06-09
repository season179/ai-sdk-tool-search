// --- Tier-1 progressive-disclosure catalog ---------------------------------

/**
 * Builds the skills section appended to the system prompt — tier 1 of
 * progressive disclosure (name + description per skill, loaded at session
 * start). This is the single source of truth for the catalog string: the chat
 * route injects exactly this text, and the token-measurement layer
 * (`buildSkillsMetadata`) measures exactly this text, so the displayed tier-1
 * cost can never drift from what is actually sent.
 *
 * Returns "" when there are no skills, so the catalog AND its behavioral
 * instructions are omitted entirely — the spec warns that an empty catalog (or
 * a skill tool with no valid options) only confuses the model.
 *
 * Each skill is on its own line as `- name: description`. A per-line format —
 * rather than joining entries with "; " — keeps the boundary between skills
 * unambiguous even when a description itself contains ':' or ';'.
 */
export function buildSkillsCatalog(skills: Array<{ name: string; description: string }>): string {
  if (skills.length === 0) {
    return "";
  }

  const lines = skills.map((skill) => `- ${skill.name}: ${skill.description}`).join("\n");

  return (
    "\n\nAvailable skills — when a task matches one, call skill_read with the skill's exact name " +
    "to load its full instructions plus a listing of any bundled resources. To read a listed " +
    "resource, call skill_read again with that resource's path.\n" +
    lines
  );
}
