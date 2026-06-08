import { skillErrorResponse } from "@/app/api/skills/_errors";
import { createSkillResource, listSkillResourcesBySkillId } from "@/lib/skills/skills";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const resources = await listSkillResourcesBySkillId(id);
    return Response.json({ resources });
  } catch (error) {
    return skillErrorResponse(error);
  }
}

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;

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
    const resource = await createSkillResource({
      skillId: id,
      path: String(body.path ?? ""),
      contentType: body.contentType,
      body: body.body,
    });

    return Response.json({ resource }, { status: 201 });
  } catch (error) {
    return skillErrorResponse(error);
  }
}
