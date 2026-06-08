import { skillErrorResponse } from "@/app/api/skills/_errors";
import { createSkill, listAllSkills } from "@/lib/skills/skills";

export async function GET() {
  try {
    const skills = await listAllSkills();
    return Response.json({ skills });
  } catch (error) {
    return skillErrorResponse(error);
  }
}

export async function POST(req: Request) {
  let body: {
    name?: string;
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
    const skill = await createSkill({
      name: String(body.name ?? ""),
      description: String(body.description ?? ""),
      body: body.body,
      license: body.license,
      compatibility: body.compatibility,
      allowedTools: body.allowedTools,
      metadata: body.metadata,
      enabled: body.enabled,
    });

    return Response.json({ skill }, { status: 201 });
  } catch (error) {
    return skillErrorResponse(error);
  }
}
