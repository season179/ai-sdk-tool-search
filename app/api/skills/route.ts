import { skillErrorResponse } from "@/app/api/skills/_errors";
import { createSkill, listSkills, type SkillReferenceInput } from "@/lib/skills/skills";

export async function GET() {
  try {
    const skills = await listSkills();
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
    references?: SkillReferenceInput[];
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
      body: String(body.body ?? ""),
      references: Array.isArray(body.references) ? body.references : undefined,
    });

    return Response.json({ skill }, { status: 201 });
  } catch (error) {
    return skillErrorResponse(error);
  }
}
