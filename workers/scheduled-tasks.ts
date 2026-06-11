import "@/lib/scheduler/load-env";

import type { Job } from "pg-boss";

import { getBoss, stopBoss, TASK_QUEUE_NAME } from "@/lib/scheduler/boss";
import { recoverMissedCronRuns } from "@/lib/scheduler/catchup";
import { closePool } from "@/lib/scheduler/db";
import { executeScheduledTaskPayload } from "@/lib/scheduler/execute";
import {
  getScheduledTaskById,
  markRunCompleted,
  markRunFailed,
  markRunSkipped,
  markRunStarted,
  markTaskCompleted,
} from "@/lib/scheduler/tasks";

type TaskJobData = {
  taskId?: string;
};

async function processJob(job: Job<TaskJobData>) {
  const taskId = job.data?.taskId;

  if (!taskId) {
    throw new Error(`Job ${job.id} is missing a taskId.`);
  }

  const task = await getScheduledTaskById(taskId);

  if (!task) {
    console.warn(`Job ${job.id} references missing task ${taskId}; skipping.`);
    return;
  }

  if (task.status !== "active") {
    await markRunSkipped(task.id, job.id, `Task was ${task.status} when the job ran.`);
    console.log(`Skipped run for ${task.status} task ${task.id} (job ${job.id}).`);
    return;
  }

  await markRunStarted(task.id, job.id);

  try {
    const output = await executeScheduledTaskPayload(task.payload);
    await markRunCompleted(job.id, output);

    if (task.scheduleType === "once") {
      await markTaskCompleted(task.id);
    }

    console.log(`Completed run for task ${task.id} (job ${job.id}).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markRunFailed(job.id, message);
    console.error(`Run failed for task ${task.id} (job ${job.id}): ${message}`);
    // Rethrow so pg-boss applies retry and dead-letter policy.
    throw error;
  }
}

async function main() {
  const boss = await getBoss();

  // Catch-up is best-effort: run it alongside the worker so a bad task row
  // or a flaky database can never block or crashloop job consumption.
  void recoverMissedCronRuns()
    .then((recovered) => {
      if (recovered > 0) {
        console.log(`Queued ${recovered} catch-up run(s) for cron fires missed while down.`);
      }
    })
    .catch((error) => {
      console.error("Missed-run catch-up failed; worker continues without it", error);
    });

  await boss.work<TaskJobData>(TASK_QUEUE_NAME, { pollingIntervalSeconds: 2 }, async (jobs) => {
    for (const job of jobs) {
      await processJob(job);
    }
  });

  console.log(`Scheduled-task worker listening on '${TASK_QUEUE_NAME}'.`);
}

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`Received ${signal}; stopping worker...`);

  try {
    await stopBoss({ graceful: true });
    await closePool();
    process.exit(0);
  } catch (error) {
    console.error("Worker shutdown failed", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((error) => {
  console.error("Worker failed to start", error);
  process.exit(1);
});
