import "@/lib/scheduler/load-env";

import { stopBoss } from "@/lib/scheduler/boss";
import { closePool } from "@/lib/scheduler/db";
import {
  createScheduledTask,
  getScheduledTaskRuns,
  listScheduledTasks,
} from "@/lib/scheduler/tasks";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const task = await createScheduledTask({
    title: "Smoke test: search GitHub repos",
    payload: {
      kind: "tool_call",
      toolName: "github_search_repositories",
      arguments: { query: "pg-boss", per_page: 3 },
    },
    scheduleType: "once",
    runAt: new Date(Date.now() + 5_000).toISOString(),
  });

  console.log("Created task", task.id, "status", task.status, "jobId", task.jobId);

  await sleep(15_000);

  const runs = await getScheduledTaskRuns(task.id);
  const tasks = await listScheduledTasks();
  const refreshed = tasks.find((entry) => entry.id === task.id);

  console.log("Task status after wait:", refreshed?.status, "lastRun:", refreshed?.lastRun?.status);
  console.log(
    "Runs:",
    runs.map((run) => ({ status: run.status, hasOutput: run.output != null, error: run.error })),
  );

  if (refreshed?.status !== "completed" || runs[0]?.status !== "completed") {
    throw new Error("Smoke test failed: task did not complete.");
  }

  console.log("Smoke test passed.");
}

async function run() {
  try {
    await main();
    return 0;
  } catch (error) {
    console.error(error);
    return 1;
  } finally {
    await stopBoss().catch(() => undefined);
    await closePool().catch(() => undefined);
  }
}

void run().then((code) => process.exit(code));
