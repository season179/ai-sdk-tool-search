import { SkillDuplicateNameError, SkillNotFoundError, SkillsInputError } from "@/lib/skills/skills";

export function skillErrorResponse(error: unknown) {
  if (error instanceof SkillNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof SkillsInputError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof SkillDuplicateNameError) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  console.error("Skill request failed", error);
  return Response.json(
    {
      error:
        "Skills service is unavailable. Check that Postgres is running and DATABASE_URL is set.",
    },
    { status: 500 },
  );
}
