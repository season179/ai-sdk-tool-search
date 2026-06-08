import { skillErrorResponse } from "@/app/api/skills/_errors";
import { deleteSkillResource, updateSkillResource } from "@/lib/skills/skills";

type RouteContext = {
  params: Promise<{ id: string; resourceId: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  const { id, resourceId } = await context.params;

  let body: {
    path?: string;
    contentType?: string;
    body?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const resource = await updateSkillResource(id, resourceId, {
      path: body.path,
      contentType: body.contentType,
      body: body.body,
    });

    return Response.json({ resource });
  } catch (error) {
    return skillErrorResponse(error);
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id, resourceId } = await context.params;

  try {
    const resource = await deleteSkillResource(id, resourceId);
    return Response.json({ resource });
  } catch (error) {
    return skillErrorResponse(error);
  }
}
