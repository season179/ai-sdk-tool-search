create table if not exists agent_scheduled_tasks (
  id uuid primary key,
  title text not null,
  -- Discriminated execution payload. V1 only supports:
  --   { "kind": "tool_call", "toolName": string, "arguments": object }
  -- Future kinds (e.g. "instruction") extend the worker dispatcher without a migration.
  payload jsonb not null,
  schedule_type text not null check (schedule_type in ('once', 'cron')),
  run_at timestamptz,
  cron text,
  timezone text not null default 'UTC',
  status text not null check (status in ('active', 'paused', 'completed', 'cancelled')),
  queue_name text not null,
  schedule_key text,
  job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (schedule_type = 'once' and run_at is not null)
    or (schedule_type = 'cron' and cron is not null)
  )
);

create table if not exists agent_scheduled_task_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references agent_scheduled_tasks(id),
  pg_boss_job_id uuid not null,
  status text not null check (status in ('running', 'completed', 'failed', 'skipped')),
  output jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (pg_boss_job_id)
);

create index if not exists agent_scheduled_task_runs_task_id_idx
  on agent_scheduled_task_runs (task_id, started_at desc);
