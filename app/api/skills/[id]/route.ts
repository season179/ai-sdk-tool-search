import { skillErrorResponse } from "@/app/api/skills/_errors";
import { deleteSkill, type SkillReferenceInput, updateSkill } from "@/lib/skills/skills";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;

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

  try {
    await deleteSkill(id);
    return Response.json({ ok: true });
  } catch (error) {
    return skillErrorResponse(error);
  }
}
