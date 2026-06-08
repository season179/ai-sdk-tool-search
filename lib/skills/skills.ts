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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
