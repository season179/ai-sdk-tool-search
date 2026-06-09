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
  updated_at timestamptz not null default now(),
  -- Per the Agent Skills spec, metadata is a map of string keys to string
  -- values. Mirror lib/skills/skills.ts validateMetadata at the storage layer:
  -- allow "no metadata", or a JSON object with no non-string value. jsonb keys
  -- are always strings, so only values need checking. "No metadata" covers both
  -- SQL NULL and the jsonb value 'null' (jsonb_typeof = 'null'): both mean absent.
  constraint agent_skills_metadata_string_map check (
    metadata is null
    or jsonb_typeof(metadata) = 'null'
    or (
      jsonb_typeof(metadata) = 'object'
      and not jsonb_path_exists(metadata, '$.* ? (@.type() != "string")')
    )
  )
);

create index if not exists agent_skills_name_idx
  on agent_skills (name);

create index if not exists agent_skills_enabled_idx
  on agent_skills (enabled) where enabled = true;
