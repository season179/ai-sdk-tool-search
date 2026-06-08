create table if not exists agent_skill_resources (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references agent_skills(id) on delete cascade,
  path text not null,
  content_type text not null default 'text/markdown',
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (skill_id, path)
);

create index if not exists agent_skill_resources_skill_id_idx
  on agent_skill_resources (skill_id);
