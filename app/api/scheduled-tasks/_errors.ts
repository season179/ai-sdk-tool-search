import { ScheduledPayloadError } from "@/lib/scheduler/execute";
import { ScheduledTaskNotFoundError, SchedulerInputError } from "@/lib/scheduler/tasks";

export function schedulerErrorResponse(error: unknown) {
  if (error instanceof ScheduledTaskNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof SchedulerInputError || error instanceof ScheduledPayloadError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error("Scheduled-task request failed", error);
  return Response.json(
    { error: "Scheduler is unavailable. Check that Postgres is running and DATABASE_URL is set." },
    { status: 500 },
  );
}
