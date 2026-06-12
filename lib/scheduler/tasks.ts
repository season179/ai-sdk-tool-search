import { randomUUID } from "node:crypto";

import { CronExpressionParser } from "cron-parser";

import {
  getBoss,
  TASK_QUEUE_NAME,
  taskScheduleOptions,
  taskSendOptions,
} from "@/lib/scheduler/boss";
import { getPool } from "@/lib/scheduler/db";
import { getDefaultScheduleTimezone } from "@/lib/scheduler/env";
import {
  clampChainDelaySeconds,
  parseScheduledTaskPayload,
  type ScheduledTaskPayload,
} from "@/lib/scheduler/execute";

export type ScheduledTaskStatus = "active" | "paused" | "completed" | "cancelled";

export type ScheduledTaskRunStatus = "running" | "completed" | "failed" | "skipped";

export type ScheduledTaskLastRun = {
  status: ScheduledTaskRunStatus;
  startedAt: string;
  completedAt: string | null;
  output: unknown;
  error: string | null;
};

export type ScheduledTask = {
  id: string;
  title: string;
  payload: ScheduledTaskPayload;
  scheduleType: "once" | "cron";
  runAt: string | null;
  cron: string | null;
  timezone: string;
  status: ScheduledTaskStatus;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
  lastRun: ScheduledTaskLastRun | null;
};

export type ScheduledTaskRun = {
  id: string;
  taskId: string;
  status: ScheduledTaskRunStatus;
  output: unknown;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type CreateScheduledTaskInput = {
  title: string;
  payload: unknown;
  scheduleType: "once" | "cron";
  /** ISO 8601 timestamp; required when scheduleType is 'once'. */
  runAt?: string;
  /** Cron expression; required when scheduleType is 'cron'. */
  cron?: string;
  /** IANA timezone for cron evaluation. Defaults to DEFAULT_SCHEDULE_TIMEZONE. */
  timezone?: string;
};

export class SchedulerInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulerInputError";
  }
}

export class ScheduledTaskNotFoundError extends SchedulerInputError {
  constructor(id: string) {
    super(`No scheduled task with id '${id}' was found.`);
    this.name = "ScheduledTaskNotFoundError";
  }
}

type TaskRow = {
  id: string;
  title: string;
  payload: ScheduledTaskPayload;
  schedule_type: "once" | "cron";
  run_at: Date | null;
  cron: string | null;
  timezone: string;
  status: ScheduledTaskStatus;
  job_id: string | null;
  created_at: Date;
  updated_at: Date;
  last_run_status?: ScheduledTaskRunStatus | null;
  last_run_started_at?: Date | null;
  last_run_completed_at?: Date | null;
  last_run_output?: unknown;
  last_run_error?: string | null;
};

export async function createScheduledTask(input: CreateScheduledTaskInput) {
  const title = input.title?.trim();

  if (!title) {
    throw new SchedulerInputError("Task title is required.");
  }

  const payload = parseScheduledTaskPayload(input.payload);
  const id = randomUUID();
  const pool = getPool();
  const boss = await getBoss();

  if (input.scheduleType === "once") {
    const runAt = parseRunAt(input.runAt);

    await pool.query(
      `insert into agent_scheduled_tasks
        (id, title, payload, schedule_type, run_at, timezone, status, queue_name)
       values ($1, $2, $3, 'once', $4, 'UTC', 'active', $5)`,
      [id, title, payload, runAt.toISOString(), TASK_QUEUE_NAME],
    );

    try {
      const jobId = await boss.sendAfter(
        TASK_QUEUE_NAME,
        { taskId: id },
        taskSendOptions(id),
        runAt,
      );

      if (!jobId) {
        throw new Error("pg-boss did not return a job id for the scheduled task.");
      }

      await pool.query(
        "update agent_scheduled_tasks set job_id = $2, updated_at = now() where id = $1",
        [id, jobId],
      );
    } catch (error) {
      await pool.query("delete from agent_scheduled_tasks where id = $1", [id]);
      throw error;
    }
  } else if (input.scheduleType === "cron") {
    const cron = input.cron?.trim();

    if (!cron) {
      throw new SchedulerInputError("A cron expression is required for recurring tasks.");
    }

    const timezone = parseTimezone(input.timezone);
    parseCron(cron, timezone);

    await pool.query(
      `insert into agent_scheduled_tasks
        (id, title, payload, schedule_type, cron, timezone, status, queue_name, schedule_key)
       values ($1, $2, $3, 'cron', $4, $5, 'active', $6, $7)`,
      [id, title, payload, cron, timezone, TASK_QUEUE_NAME, id],
    );

    try {
      await boss.schedule(TASK_QUEUE_NAME, cron, { taskId: id }, taskScheduleOptions(id, timezone));
    } catch (error) {
      await pool.query("delete from agent_scheduled_tasks where id = $1", [id]);
      throw error;
    }
  } else {
    throw new SchedulerInputError("scheduleType must be 'once' or 'cron'.");
  }

  return requireScheduledTask(id);
}

export async function cancelScheduledTask(id: string) {
  const task = await requireScheduledTask(id);

  if (task.status === "cancelled") {
    return task;
  }

  if (task.status === "completed") {
    throw new SchedulerInputError("This task already completed; there is nothing to cancel.");
  }

  if (task.status === "active") {
    await detachFromBoss(task);
  }

  await updateTaskStatus(id, "cancelled");

  return requireScheduledTask(id);
}

export async function pauseScheduledTask(id: string) {
  const task = await requireScheduledTask(id);

  if (task.status !== "active") {
    throw new SchedulerInputError(`Only active tasks can be paused. This task is ${task.status}.`);
  }

  await detachFromBoss(task);
  await updateTaskStatus(id, "paused");

  return requireScheduledTask(id);
}

export async function resumeScheduledTask(id: string) {
  const task = await requireScheduledTask(id);

  if (task.status !== "paused") {
    throw new SchedulerInputError(`Only paused tasks can be resumed. This task is ${task.status}.`);
  }

  const boss = await getBoss();

  if (task.scheduleType === "cron") {
    if (!task.cron) {
      throw new SchedulerInputError("This recurring task has no cron expression.");
    }

    await boss.schedule(
      TASK_QUEUE_NAME,
      task.cron,
      { taskId: id },
      taskScheduleOptions(id, task.timezone),
    );
    await updateTaskStatus(id, "active");
  } else {
    // Self-chaining instruction tasks have no meaningful run_at once the chain
    // is moving: resume picks the chain back up after one cadence delay.
    const runAt =
      task.payload.kind === "instruction"
        ? new Date(Date.now() + clampChainDelaySeconds(task.payload.cadenceSeconds) * 1000)
        : task.runAt
          ? new Date(task.runAt)
          : null;

    if (!runAt || runAt.getTime() <= Date.now()) {
      throw new SchedulerInputError(
        "This task's run time has already passed. Create a new task instead of resuming.",
      );
    }

    // Pausing cancelled the original job, so resume sends a fresh one.
    const jobId = await boss.sendAfter(TASK_QUEUE_NAME, { taskId: id }, taskSendOptions(id), runAt);

    if (!jobId) {
      throw new Error("pg-boss did not return a job id while resuming the task.");
    }

    await getPool().query(
      "update agent_scheduled_tasks set status = 'active', job_id = $2, updated_at = now() where id = $1",
      [id, jobId],
    );
  }

  return requireScheduledTask(id);
}

export async function listScheduledTasks() {
  const { rows } = await getPool().query<TaskRow>(
    `select t.id, t.title, t.payload, t.schedule_type, t.run_at, t.cron, t.timezone, t.status,
            t.job_id, t.created_at, t.updated_at,
            r.status as last_run_status,
            r.started_at as last_run_started_at,
            r.completed_at as last_run_completed_at,
            r.output as last_run_output,
            r.error as last_run_error
     from agent_scheduled_tasks t
     left join lateral (
       select status, started_at, completed_at, output, error
       from agent_scheduled_task_runs
       where task_id = t.id
       order by started_at desc
       limit 1
     ) r on true
     order by t.created_at desc
     limit 100`,
  );

  return rows.map(mapTaskRow);
}

export async function getScheduledTaskById(id: string) {
  const { rows } = await getPool().query<TaskRow>(
    `select id, title, payload, schedule_type, run_at, cron, timezone, status, job_id, created_at, updated_at
     from agent_scheduled_tasks
     where id = $1`,
    [id],
  );

  return rows[0] ? mapTaskRow(rows[0]) : null;
}

export async function getScheduledTaskRuns(taskId: string) {
  await requireScheduledTask(taskId);

  const { rows } = await getPool().query<{
    id: string;
    task_id: string;
    status: ScheduledTaskRunStatus;
    output: unknown;
    error: string | null;
    started_at: Date;
    completed_at: Date | null;
  }>(
    `select id, task_id, status, output, error, started_at, completed_at
     from agent_scheduled_task_runs
     where task_id = $1
     order by started_at desc
     limit 50`,
    [taskId],
  );

  return rows.map(
    (row): ScheduledTaskRun => ({
      id: row.id,
      taskId: row.task_id,
      status: row.status,
      output: row.output,
      error: row.error,
      startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null,
    }),
  );
}

// --- Worker-facing helpers -------------------------------------------------

export async function markRunStarted(taskId: string, pgBossJobId: string) {
  await getPool().query(
    `insert into agent_scheduled_task_runs (task_id, pg_boss_job_id, status)
     values ($1, $2, 'running')
     on conflict (pg_boss_job_id)
     do update set status = 'running', started_at = now(), completed_at = null, output = null, error = null`,
    [taskId, pgBossJobId],
  );
}

export async function markRunSkipped(taskId: string, pgBossJobId: string, reason: string) {
  await getPool().query(
    `insert into agent_scheduled_task_runs (task_id, pg_boss_job_id, status, error, completed_at)
     values ($1, $2, 'skipped', $3, now())
     on conflict (pg_boss_job_id)
     do update set status = 'skipped', error = $3, completed_at = now()`,
    [taskId, pgBossJobId, reason],
  );
}

export async function markRunCompleted(pgBossJobId: string, output: unknown) {
  await getPool().query(
    `update agent_scheduled_task_runs
     set status = 'completed', output = $2, completed_at = now()
     where pg_boss_job_id = $1`,
    [pgBossJobId, output === undefined ? null : JSON.stringify(output)],
  );
}

export async function markRunFailed(pgBossJobId: string, error: string) {
  await getPool().query(
    `update agent_scheduled_task_runs
     set status = 'failed', error = $2, completed_at = now()
     where pg_boss_job_id = $1`,
    [pgBossJobId, error],
  );
}

export async function markTaskCompleted(id: string) {
  await getPool().query(
    "update agent_scheduled_tasks set status = 'completed', updated_at = now() where id = $1 and status = 'active'",
    [id],
  );
}

/** Abnormal chain stop (e.g. consecutive failures). No pending job to detach. */
export async function markTaskCancelled(id: string) {
  await getPool().query(
    "update agent_scheduled_tasks set status = 'cancelled', updated_at = now() where id = $1 and status = 'active'",
    [id],
  );
}

/** Advance an instruction payload's round counter ahead of the next fire. */
export async function setInstructionRound(id: string, round: number) {
  await getPool().query(
    `update agent_scheduled_tasks
     set payload = jsonb_set(payload, '{round}', to_jsonb($2::int), true), updated_at = now()
     where id = $1`,
    [id, round],
  );
}

/** Keep job_id pointing at the latest chained job so pause can cancel it. */
export async function updateTaskJobId(id: string, jobId: string) {
  await getPool().query(
    "update agent_scheduled_tasks set job_id = $2, updated_at = now() where id = $1",
    [id, jobId],
  );
}

export async function getLatestCompletedRunOutput(taskId: string) {
  const { rows } = await getPool().query<{ output: unknown }>(
    `select output
     from agent_scheduled_task_runs
     where task_id = $1 and status = 'completed'
     order by started_at desc
     limit 1`,
    [taskId],
  );

  return rows[0]?.output ?? null;
}

/** Length of the trailing run of 'failed' statuses, capped at `limit`. */
export async function countConsecutiveFailedRuns(taskId: string, limit: number) {
  const { rows } = await getPool().query<{ status: ScheduledTaskRunStatus }>(
    `select status
     from agent_scheduled_task_runs
     where task_id = $1
     order by started_at desc
     limit $2`,
    [taskId, limit],
  );

  let failures = 0;

  for (const row of rows) {
    if (row.status !== "failed") {
      break;
    }

    failures += 1;
  }

  return failures;
}

// --- Internals --------------------------------------------------------------

async function updateTaskStatus(id: string, status: ScheduledTaskStatus) {
  await getPool().query(
    "update agent_scheduled_tasks set status = $2, updated_at = now() where id = $1",
    [id, status],
  );
}

async function requireScheduledTask(id: string) {
  const task = await getScheduledTaskById(id);

  if (!task) {
    throw new ScheduledTaskNotFoundError(id);
  }

  return task;
}

async function detachFromBoss(task: ScheduledTask) {
  const boss = await getBoss();

  if (task.scheduleType === "cron") {
    await boss.unschedule(TASK_QUEUE_NAME, task.id);
  } else if (task.jobId) {
    await boss.cancel(TASK_QUEUE_NAME, task.jobId);
  }
}

function parseRunAt(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new SchedulerInputError("A runAt timestamp is required for one-off tasks.");
  }

  const runAt = new Date(trimmed);

  if (Number.isNaN(runAt.getTime())) {
    throw new SchedulerInputError(`'${trimmed}' is not a valid ISO 8601 timestamp.`);
  }

  if (runAt.getTime() <= Date.now()) {
    throw new SchedulerInputError("runAt must be in the future.");
  }

  return runAt;
}

function parseCron(cron: string, timezone: string) {
  try {
    // Same parser and options pg-boss validates with, so anything accepted
    // here is also accepted by boss.schedule and the catch-up reconciler.
    CronExpressionParser.parse(cron, { tz: timezone });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SchedulerInputError(`Invalid cron expression '${cron}': ${message}`);
  }
}

function parseTimezone(value: string | undefined) {
  const timezone = value?.trim() || getDefaultScheduleTimezone();

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new SchedulerInputError(`'${timezone}' is not a valid IANA timezone.`);
  }

  return timezone;
}

function mapTaskRow(row: TaskRow): ScheduledTask {
  return {
    id: row.id,
    title: row.title,
    payload: row.payload,
    scheduleType: row.schedule_type,
    runAt: row.run_at?.toISOString() ?? null,
    cron: row.cron,
    timezone: row.timezone,
    status: row.status,
    jobId: row.job_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastRun: row.last_run_status
      ? {
          status: row.last_run_status,
          startedAt: row.last_run_started_at?.toISOString() ?? "",
          completedAt: row.last_run_completed_at?.toISOString() ?? null,
          output: row.last_run_output ?? null,
          error: row.last_run_error ?? null,
        }
      : null,
  };
}
