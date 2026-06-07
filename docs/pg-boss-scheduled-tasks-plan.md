# pg-boss Scheduled Tasks Plan

## Objective

Give the agent a real scheduled-task capability while preserving the repo's current purpose: a focused Next.js chat harness for tool-search experiments. The first version should let the agent create, list, cancel, and inspect scheduled tasks without turning the UI into a production dashboard.

## Current Context

- The app is a Next.js App Router chat surface using OpenRouter, the AI SDK, and a tool-search bridge.
- Existing tools are realistic but mock-backed; scheduled tasks should be the first real side-effecting tool surface.
- The app currently has no database dependency, so adding pg-boss also means introducing Postgres configuration and a long-running worker process.

## pg-boss Facts To Design Around

- Use `pg-boss@12.18.2` or newer in the same major version unless a later compatibility check says otherwise.
- pg-boss currently requires Node 22.12+ and PostgreSQL 13+.
- Recurring schedules use `boss.schedule(name, cron, data, options)`.
- One-off future jobs should use `boss.sendAfter(name, data, options, date)` or `boss.send(..., { startAfter })`.
- Recurring schedules can be removed with `boss.unschedule(name, key)`.
- Schedules can be inspected with `boss.getSchedules(name, key)`.
- The `name` argument is the queue name. Use `options.key` as the app's task id so multiple schedules can target the same queue.
- Use `options.tz` for cron timezone. Default to `UTC` unless the UI or user explicitly supplies a timezone.
- pg-boss workers and the Timekeeper should run in a long-lived worker process, not inside request handlers.

Sources checked on 2026-06-07:

- https://github.com/timgit/pg-boss
- https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/jobs.md
- https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/workers.md
- https://raw.githubusercontent.com/timgit/pg-boss/master/src/index.ts
- https://deepwiki.com/timgit/pg-boss

## Proposed Architecture

### 1. Environment And Dependencies

Add:

```bash
pnpm add pg-boss
```

Add these environment variables:

```bash
DATABASE_URL=
PGBOSS_SCHEMA=pgboss
DEFAULT_SCHEDULE_TIMEZONE=UTC
```

Keep OpenRouter configuration separate from queue configuration. The chat route should fail clearly if OpenRouter env is missing; the scheduler should fail clearly if database env is missing.

### 2. App-Owned Task Tables

pg-boss owns queue execution state, but the product should have its own task records. Add app tables for durable user-facing state:

```sql
create table agent_scheduled_tasks (
  id uuid primary key,
  title text not null,
  instruction text not null,
  schedule_type text not null check (schedule_type in ('once', 'cron')),
  run_at timestamptz,
  cron text,
  timezone text not null default 'UTC',
  status text not null check (status in ('active', 'paused', 'cancelled')),
  queue_name text not null,
  schedule_key text,
  job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table agent_scheduled_task_runs (
  id uuid primary key,
  task_id uuid not null references agent_scheduled_tasks(id),
  pg_boss_job_id uuid not null,
  status text not null check (status in ('running', 'completed', 'failed', 'skipped')),
  output jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (pg_boss_job_id)
);
```

This gives the UI and agent a stable source of truth without querying pg-boss internals directly.

### 3. pg-boss Client Module

Create a small server-only module:

- `lib/scheduler/boss.ts`
- exports `getBoss()` (starts pg-boss lazily on first call) and `stopBoss()`
- validates `DATABASE_URL`
- sets `schema` from `PGBOSS_SCHEMA`
- attaches `error` and `warning` listeners

The API process can use this for schedule creation and cancellation. Worker registration should live outside request handling.

### 4. Scheduling Service

Create `lib/scheduler/tasks.ts` with functions:

- `createScheduledTask(input)`
- `cancelScheduledTask(id)`
- `listScheduledTasks()`
- `getScheduledTaskRuns(taskId)`

Queue names:

- `agent-task-run`
- `agent-task-run-dlq`

Creation behavior:

- For one-off tasks, insert the app row, then call `boss.sendAfter("agent-task-run", { taskId }, options, runAt)`.
- For recurring tasks, insert the app row, then call `boss.schedule("agent-task-run", cron, { taskId }, { key: taskId, tz })`.
- Configure retries and dead-letter behavior at the queue level with `createQueue`.
- Store the pg-boss job id for one-off tasks and `taskId` as the recurring schedule key.

Cancellation behavior:

- Mark the app task `cancelled`.
- For one-off tasks, call `boss.cancel("agent-task-run", jobId)` when a job id exists.
- For recurring tasks, call `boss.unschedule("agent-task-run", taskId)`.

### 5. Worker Process

Add `workers/scheduled-tasks.ts` and a package script:

```json
{
  "scripts": {
    "worker:scheduled-tasks": "tsx workers/scheduled-tasks.ts"
  }
}
```

If the worker is run directly from TypeScript, add a runner such as `tsx` as a dev dependency. Otherwise compile the worker before running it in production.

The worker should:

1. start pg-boss
2. create both queues
3. register `boss.work("agent-task-run", { pollingIntervalSeconds: 2 }, handler)`
4. handle `SIGINT` and `SIGTERM` with `boss.stop()`

Handler behavior:

1. load the app task by id
2. skip cancelled or paused tasks
3. create a run row keyed by `pg_boss_job_id`
4. execute the stored instruction
5. store output or error

V1 execution should be conservative. Prefer one of these:

- safer V1: only allow scheduled execution of explicit tool name plus arguments
- broader V1: run the stored instruction through `ToolLoopAgent`, but disable scheduler tools during scheduled execution to avoid recursive task creation

### 6. Agent Tools

Add real scheduler tools to the bridge:

- `scheduled_task_create`
- `scheduled_task_list`
- `scheduled_task_cancel`
- `scheduled_task_get_runs`

Implementation path:

- Extend the catalog with scheduler tool specs.
- Route these tool names to the scheduling service from `tool_call`.
- Keep the existing mock-backed tools unchanged.
- Make scheduler tool outputs explicit about whether a task is one-off or recurring, what timezone is used, and whether creation succeeded.

The system prompt should instruct the model to ask a follow-up question when the user's requested time is ambiguous.

### 7. API Routes

Add thin route handlers for non-chat access:

- `GET /api/scheduled-tasks`
- `POST /api/scheduled-tasks`
- `DELETE /api/scheduled-tasks/:id`
- `GET /api/scheduled-tasks/:id/runs`

The chat tool path and direct API path should call the same scheduling service so behavior stays consistent.

### 8. UI Surface

Keep the chat as the first screen. Add a compact Tasks panel with:

- task title
- one-off or recurring label
- scheduled time or cron string
- timezone
- status
- last run state
- cancel action

Only show "next run" if it is derived from the cron expression. Do not ship decorative task metadata.

### 9. Verification

Run:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Use `agent-browser` for browser verification:

1. start Postgres and the scheduled-task worker
2. start the Next app
3. ask the agent to create a one-off task for about 10 seconds in the future
4. confirm the task appears in the Tasks panel
5. wait for execution
6. confirm a run appears with completed or failed state
7. create a recurring minute-level task
8. cancel it
9. confirm no further runs are created after cancellation

## Suggested Implementation Slices

1. Add Postgres and pg-boss wiring with a worker that can process a hard-coded test job.
2. Add app task tables and the scheduling service.
3. Add scheduler tools through the existing tool-search bridge.
4. Add the compact Tasks panel.
5. Add end-to-end verification with `agent-browser`.

## Decisions (resolved 2026-06-07)

- **Migrations:** raw SQL scripts in `db/migrations/` with a tiny runner (`scripts/migrate.ts`, `pnpm db:migrate`) tracking applied files in `schema_migrations`.
- **V1 execution:** explicit tool calls only, stored as a discriminated `payload jsonb` (`{ "kind": "tool_call", "toolName", "arguments" }`) instead of the `instruction text` column drafted above. The worker dispatches on `payload.kind`, so a future `instruction` kind (agent-loop execution) is a new dispatcher branch, not a migration — deliberately a two-way door.
- **Pause/resume:** included in V1 for both task types. Pause unschedules (cron) or cancels the pending job (one-off); resume re-schedules or sends a fresh job (one-off resume requires `run_at` still in the future). A `completed` status was also added for one-off tasks that ran.
- **Deployment:** local-only. Postgres via `docker-compose.yml` (port 5433), worker via `pnpm worker:scheduled-tasks`.

## Implementation Notes (post-build)

- pg-boss v12 uses a named export (`import { PgBoss } from "pg-boss"`), and `createQueue(name, options)` takes options without `name`.
- The chat system prompt includes the current UTC time per request; without it the model cannot resolve relative times like "in 20 seconds".
- Reusing one SQL parameter for the uuid `id` and text `schedule_key` columns fails with `42P08 inconsistent types deduced` — the insert passes the id as two parameters.
- Scheduler tool errors return `{ success: false, error }` to the model instead of throwing, so the agent can recover (observed live: it retried with a later `run_at` after a "runAt must be in the future" rejection).
