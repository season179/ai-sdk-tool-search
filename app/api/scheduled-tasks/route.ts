import { schedulerErrorResponse } from "@/app/api/scheduled-tasks/_errors";
import { createScheduledTask, listScheduledTasks } from "@/lib/scheduler/tasks";

export async function GET() {
  try {
    const tasks = await listScheduledTasks();
    return Response.json({ tasks });
  } catch (error) {
    return schedulerErrorResponse(error);
  }
}

export async function POST(req: Request) {
  let body: {
    title?: string;
    payload?: unknown;
    scheduleType?: "once" | "cron";
    runAt?: string;
    cron?: string;
    timezone?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    const task = await createScheduledTask({
      title: String(body.title ?? ""),
      payload: body.payload,
      scheduleType: body.scheduleType === "cron" ? "cron" : "once",
      runAt: body.runAt,
      cron: body.cron,
      timezone: body.timezone,
    });

    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return schedulerErrorResponse(error);
  }
}
