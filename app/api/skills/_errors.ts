import {
  SKILLS_UNAVAILABLE_MESSAGE,
  SkillInputError,
  SkillNotFoundError,
} from "@/lib/skills/skills";

export function skillErrorResponse(error: unknown) {
  if (error instanceof SkillNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof SkillInputError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error("Skill request failed", error);
  return Response.json({ error: SKILLS_UNAVAILABLE_MESSAGE }, { status: 500 });
}
