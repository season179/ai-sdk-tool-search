import { skillErrorResponse } from "@/app/api/skills/_errors";
import { deleteSkill, getSkillById, updateSkill } from "@/lib/skills/skills";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const skill = await getSkillById(id);
    return Response.json({ skill });
  } catch (error) {
    return skillErrorResponse(error);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: {
    description?: string;
    body?: string;
    license?: string | null;
    compatibility?: string | null;
    allowedTools?: string[] | null;
    metadata?: Record<string, unknown> | null;
    enabled?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const skill = await updateSkill(id, {
      description: body.description,
      body: body.body,
      license: body.license,
      compatibility: body.compatibility,
      allowedTools: body.allowedTools,
      metadata: body.metadata,
      enabled: body.enabled,
    });

    return Response.json({ skill });
  } catch (error) {
    return skillErrorResponse(error);
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const skill = await deleteSkill(id);
    return Response.json({ skill });
  } catch (error) {
    return skillErrorResponse(error);
  }
}
