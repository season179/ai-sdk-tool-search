import { getPool } from "@/lib/scheduler/db";

// --- Domain types -----------------------------------------------------------

export type Skill = {
  id: string;
  name: string;
  description: string;
  body: string;
  license: string | null;
  compatibility: string | null;
  allowedTools: string[] | null;
  metadata: Record<string, unknown> | null;
  version: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

// --- Error classes ----------------------------------------------------------

export class SkillsInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillsInputError";
  }
}

// --- Row type ---------------------------------------------------------------

type SkillRow = {
  id: string;
  name: string;
  description: string;
  body: string;
  license: string | null;
  compatibility: string | null;
  allowed_tools: unknown;
  metadata: unknown;
  version: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

// --- Domain types (resources) ----------------------------------------------

export type SkillResource = {
  id: string;
  skillId: string;
  path: string;
  contentType: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

// --- Row type (resources) ---------------------------------------------------

type SkillResourceRow = {
  id: string;
  skill_id: string;
  path: string;
  content_type: string;
  body: string;
  created_at: Date;
  updated_at: Date;
};

// --- Public API -------------------------------------------------------------

export async function listEnabledSkills(): Promise<Skill[]> {
  const { rows } = await getPool().query<SkillRow>(
    `select id, name, description, body, license, compatibility, allowed_tools, metadata,
            version, enabled, created_at, updated_at
     from agent_skills
     where enabled = true
     order by name`,
  );

  return rows.map(mapSkillRow);
}

export async function getSkillByName(name: string): Promise<Skill | null> {
  const { rows } = await getPool().query<SkillRow>(
    `select id, name, description, body, license, compatibility, allowed_tools, metadata,
            version, enabled, created_at, updated_at
     from agent_skills
     where name = $1`,
    [name],
  );

  return rows[0] ? mapSkillRow(rows[0]) : null;
}

export function validateSkillInput(input: {
  name?: unknown;
  description?: unknown;
  compatibility?: unknown;
}): void {
  if (typeof input.name !== "string" || !input.name.trim()) {
    throw new SkillsInputError("Skill name is required.");
  }

  const name = input.name.trim();

  if (name.length > 64) {
    throw new SkillsInputError("Skill name must be 64 characters or fewer.");
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new SkillsInputError(
      "Skill name must match ^[a-z0-9]+(-[a-z0-9]+)*$ (lowercase alphanumeric with single hyphens).",
    );
  }

  if (typeof input.description !== "string" || !input.description.trim()) {
    throw new SkillsInputError("Skill description is required and must be non-empty.");
  }

  if (input.description.trim().length > 1024) {
    throw new SkillsInputError("Skill description must be 1024 characters or fewer.");
  }

  if (input.compatibility !== undefined && input.compatibility !== null) {
    if (typeof input.compatibility !== "string") {
      throw new SkillsInputError("Skill compatibility must be a string.");
    }

    if (input.compatibility.length > 500) {
      throw new SkillsInputError("Skill compatibility must be 500 characters or fewer.");
    }
  }
}

export function validateResourcePath(path: string): void {
  if (!path || path.length === 0) {
    throw new SkillsInputError("Resource path must be a non-empty string.");
  }

  if (path.startsWith("/")) {
    throw new SkillsInputError("Resource path must not start with '/'.");
  }

  if (path.includes("..")) {
    throw new SkillsInputError("Resource path must not contain '..' segments.");
  }
}

export async function listSkillResources(skillName: string): Promise<SkillResource[]> {
  const { rows } = await getPool().query<SkillResourceRow>(
    `select r.id, r.skill_id, r.path, r.content_type, r.body, r.created_at, r.updated_at
     from agent_skill_resources r
     join agent_skills s on s.id = r.skill_id
     where s.name = $1
     order by r.path`,
    [skillName],
  );

  return rows.map(mapSkillResourceRow);
}

export async function getSkillResource(
  skillName: string,
  path: string,
): Promise<SkillResource | null> {
  validateResourcePath(path);

  const { rows } = await getPool().query<SkillResourceRow>(
    `select r.id, r.skill_id, r.path, r.content_type, r.body, r.created_at, r.updated_at
     from agent_skill_resources r
     join agent_skills s on s.id = r.skill_id
     where s.name = $1 and r.path = $2`,
    [skillName, path],
  );

  return rows[0] ? mapSkillResourceRow(rows[0]) : null;
}

// --- Internals --------------------------------------------------------------

function mapSkillRow(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    body: row.body,
    license: row.license,
    compatibility: row.compatibility,
    allowedTools: Array.isArray(row.allowed_tools) ? row.allowed_tools : null,
    metadata: isRecord(row.metadata) ? (row.metadata as Record<string, unknown>) : null,
    version: row.version,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapSkillResourceRow(row: SkillResourceRow): SkillResource {
  return {
    id: row.id,
    skillId: row.skill_id,
    path: row.path,
    contentType: row.content_type,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
