create table if not exists agent_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  body text not null,
  license text,
  compatibility text,
  allowed_tools jsonb,
  metadata jsonb,
  version integer not null default 1,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_skills_name_idx
  on agent_skills (name);

create index if not exists agent_skills_enabled_idx
  on agent_skills (enabled) where enabled = true;
