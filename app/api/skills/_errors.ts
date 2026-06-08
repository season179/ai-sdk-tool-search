import {
  isPgError,
  SkillDuplicateNameError,
  SkillNotFoundError,
  SkillResourceDuplicatePathError,
  SkillResourceNotFoundError,
  SkillsInputError,
} from "@/lib/skills/skills";

export function skillErrorResponse(error: unknown) {
  if (error instanceof SkillNotFoundError || error instanceof SkillResourceNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof SkillsInputError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  // A malformed uuid in the route path reaches Postgres as 22P02 — that's a client
  // error (bad id), not a service outage, so surface it as 400 rather than 500.
  if (isPgError(error, "22P02")) {
    return Response.json({ error: "Invalid id format." }, { status: 400 });
  }

  if (
    error instanceof SkillDuplicateNameError ||
    error instanceof SkillResourceDuplicatePathError
  ) {
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
