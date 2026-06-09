-- Singleton agent for this single-agent app. Mirror as DEFAULT_AGENT_ID in app code.
-- When multi-agent arrives, start passing real ids -- no migration needed.
create table if not exists agent_skills (
  id           uuid primary key default gen_random_uuid(),
  agent_id     uuid not null default '00000000-0000-0000-0000-000000000001',
  -- No ON DELETE action: a parent skill with references cannot be hard-deleted.
  -- Removal is soft-delete only (set deleted_at); the app soft-deletes children too.
  parent_id    uuid references agent_skills(id),
  type         text not null check (type in ('skill', 'reference')),
  name         text not null check (char_length(name) between 1 and 64),
  description  text not null check (char_length(description) between 1 and 1024),
  body         text not null,
  is_enabled   boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  deleted_at   timestamptz,
  deleted_by   uuid,
  -- A reference hangs off a parent skill; a skill is top-level.
  constraint agent_skills_parent_shape check (
    (type = 'skill'     and parent_id is null)
    or (type = 'reference' and parent_id is not null)
  )
);

-- Skill names unique per agent (live rows only; soft-deleted names are reusable)
create unique index if not exists agent_skills_skill_name_uniq
  on agent_skills (agent_id, name)
  where type = 'skill' and deleted_at is null;

-- Reference names unique within their parent skill (live rows only)
create unique index if not exists agent_skills_reference_name_uniq
  on agent_skills (parent_id, name)
  where type = 'reference' and deleted_at is null;

-- Tier-1 catalog query: an agent's enabled, live skills
create index if not exists agent_skills_catalog_idx
  on agent_skills (agent_id)
  where type = 'skill' and is_enabled = true and deleted_at is null;

-- Resolve a skill's child references (live rows only)
create index if not exists agent_skills_parent_idx
  on agent_skills (parent_id)
  where deleted_at is null;
