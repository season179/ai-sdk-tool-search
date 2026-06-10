import { skillErrorResponse } from "@/app/api/skills/_errors";
import { deleteSkill, type SkillReferenceInput, updateSkill } from "@/lib/skills/skills";
import { isUuid } from "@/lib/skills/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Non-uuid ids would fail the uuid cast in Postgres; treat them as not found. */
function invalidIdResponse(id: string) {
  return Response.json({ error: `No skill with id '${id}' was found.` }, { status: 404 });
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!isUuid(id)) {
    return invalidIdResponse(id);
  }

  let body: {
    name?: string;
    description?: string;
    body?: string;
    isEnabled?: boolean;
    references?: SkillReferenceInput[];
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const skill = await updateSkill(id, {
      name: body.name,
      description: body.description,
      body: body.body,
      isEnabled: typeof body.isEnabled === "boolean" ? body.isEnabled : undefined,
      references: Array.isArray(body.references) ? body.references : undefined,
    });

    return Response.json({ skill });
  } catch (error) {
    return skillErrorResponse(error);
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!isUuid(id)) {
    return invalidIdResponse(id);
  }

  try {
    await deleteSkill(id);
    return Response.json({ ok: true });
  } catch (error) {
    return skillErrorResponse(error);
  }
}
