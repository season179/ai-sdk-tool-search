import { schedulerErrorResponse } from "@/app/api/scheduled-tasks/_errors";
import { getScheduledTaskRuns } from "@/lib/scheduler/tasks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const runs = await getScheduledTaskRuns(id);
    return Response.json({ runs });
  } catch (error) {
    return schedulerErrorResponse(error);
  }
}
