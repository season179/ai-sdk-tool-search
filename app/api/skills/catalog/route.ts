import { skillErrorResponse } from "@/app/api/skills/_errors";
import { getSkillCatalog } from "@/lib/skills/catalog";

/**
 * Lightweight tier-1 list (enabled skills, no bodies) for the composer's
 * /skill-name autocomplete. GET /api/skills returns full bodies; this stays
 * cheap enough to fetch on the first keystroke.
 */
export async function GET() {
  try {
    return Response.json({ skills: await getSkillCatalog() });
  } catch (error) {
    return skillErrorResponse(error);
  }
}
