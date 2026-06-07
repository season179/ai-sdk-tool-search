import { schedulerErrorResponse } from "@/app/api/scheduled-tasks/_errors";
import {
  cancelScheduledTask,
  pauseScheduledTask,
  resumeScheduledTask,
} from "@/lib/scheduler/tasks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const task = await cancelScheduledTask(id);
    return Response.json({ task });
  } catch (error) {
    return schedulerErrorResponse(error);
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: { action?: string };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    if (body.action === "pause") {
      return Response.json({ task: await pauseScheduledTask(id) });
    }

    if (body.action === "resume") {
      return Response.json({ task: await resumeScheduledTask(id) });
    }

    return Response.json({ error: "action must be 'pause' or 'resume'." }, { status: 400 });
  } catch (error) {
    return schedulerErrorResponse(error);
  }
}
