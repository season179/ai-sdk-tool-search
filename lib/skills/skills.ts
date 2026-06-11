import { randomUUID } from "node:crypto";

import { getPool } from "@/lib/scheduler/db";
import {
  validateDescription,
  validateName,
  validateReferenceBody,
  validateSkillBody,
} from "@/lib/skills/validation";

// Row-shape invariant: every insert below hardcodes its type — 'skill' rows
// never get a parent_id, 'reference' rows always do. The DB backstops this
// with the agent_skills_parent_shape check constraint, so a row with a
// parent_id can only ever be a 'reference'.

/**
 * Single-agent app: every row uses this id, mirroring the column default in
 * db/migrations/002_skills.sql. When multi-agent arrives, thread real ids
 * through instead.
 */
export const DEFAULT_AGENT_ID = "00000000-0000-0000-0000-000000000001";

/** Operator hint shown when the database is unreachable; shared by API and tool layers. */
export const SKILLS_UNAVAILABLE_MESSAGE =
  "Skills are unavailable. Check that Postgres is running and DATABASE_URL is set.";

export type SkillReference = {
  id: string;
  name: string;
  description: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type Skill = {
  id: string;
  name: string;
  description: string;
  body: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  references: SkillReference[];
};

export type SkillReferenceInput = {
  /** Present when updating an existing reference; omitted for new ones. */
  id?: string;
  name: string;
  description: string;
  body: string;
};

export type CreateSkillInput = {
  name: string;
  description: string;
  body: string;
  references?: SkillReferenceInput[];
};

export type UpdateSkillInput = {
  name?: string;
  description?: string;
  body?: string;
  isEnabled?: boolean;
  /**
   * Replace-set semantics: when provided, references with an id are updated,
   * ones without an id are created, and live references missing from the
   * list are soft-deleted.
   */
  references?: SkillReferenceInput[];
};

export class SkillInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillInputError";
  }
}

export class SkillNotFoundError extends SkillInputError {
  constructor(id: string) {
    super(`No skill with id '${id}' was found.`);
    this.name = "SkillNotFoundError";
  }
}

type SkillRow = {
  id: string;
  parent_id: string | null;
  type: "skill" | "reference";
  name: string;
  description: string;
  body: string;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export async function listSkills(agentId: string = DEFAULT_AGENT_ID) {
  const { rows } = await getPool().query<SkillRow>(
    `select id, parent_id, type, name, description, body, is_enabled, created_at, updated_at
     from agent_skills
     where agent_id = $1 and deleted_at is null
     order by created_at asc`,
    [agentId],
  );

  const skills = rows
    .filter((row) => row.type === "skill")
    .map((row) => mapSkillRow(row))
    .reverse();
  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  for (const row of rows) {
    if (row.type !== "reference" || !row.parent_id) {
      continue;
    }

    byId.get(row.parent_id)?.references.push(mapReferenceRow(row));
  }

  return skills;
}

export async function getSkillById(id: string, agentId: string = DEFAULT_AGENT_ID) {
  const { rows } = await getPool().query<SkillRow>(
    `select id, parent_id, type, name, description, body, is_enabled, created_at, updated_at
     from agent_skills
     where agent_id = $1 and deleted_at is null and (id = $2 or parent_id = $2)
     order by created_at asc`,
    [agentId, id],
  );

  const skillRow = rows.find((row) => row.id === id && row.type === "skill");

  if (!skillRow) {
    return null;
  }

  const skill = mapSkillRow(skillRow);

  for (const row of rows) {
    if (row.type === "reference" && row.parent_id === id) {
      skill.references.push(mapReferenceRow(row));
    }
  }

  return skill;
}

/**
 * Loads a single live reference row by id (tier-3 resource lookup). The parent
 * skill must be live and enabled: disabling a skill hides its references from
 * the agent too.
 */
export async function getReferenceById(id: string, agentId: string = DEFAULT_AGENT_ID) {
  const { rows } = await getPool().query<SkillRow>(
    `select r.id, r.parent_id, r.type, r.name, r.description, r.body, r.is_enabled,
            r.created_at, r.updated_at
     from agent_skills r
     join agent_skills parent
       on parent.id = r.parent_id
      and parent.agent_id = r.agent_id
      and parent.deleted_at is null
      and parent.is_enabled
     where r.agent_id = $1 and r.id = $2 and r.type = 'reference' and r.deleted_at is null`,
    [agentId, id],
  );

  return rows[0] ? mapReferenceRow(rows[0]) : null;
}

/**
 * Narrow tier-1 projection for the agent's catalog: enabled skills only,
 * newest first, without dragging body columns onto the chat hot path.
 */
export async function listSkillCatalogEntries(agentId: string = DEFAULT_AGENT_ID) {
  const { rows } = await getPool().query<Pick<SkillRow, "id" | "name" | "description">>(
    `select id, name, description
     from agent_skills
     where agent_id = $1 and type = 'skill' and is_enabled and deleted_at is null
     order by created_at desc`,
    [agentId],
  );

  return rows;
}

/**
 * Resolves an enabled, live skill's id by exact name. Used for user-explicit
 * activation, where the /skill-name command carries a name, not an id.
 */
export async function getSkillIdByName(name: string, agentId: string = DEFAULT_AGENT_ID) {
  const { rows } = await getPool().query<Pick<SkillRow, "id">>(
    `select id
     from agent_skills
     where agent_id = $1 and type = 'skill' and name = $2 and is_enabled and deleted_at is null`,
    [agentId, name],
  );

  return rows[0]?.id ?? null;
}

export type SkillSearchHit = {
  id: string;
  type: "skill" | "reference";
  name: string;
  description: string;
  /** For reference hits: the id of the skill the reference belongs to. */
  skillId: string | null;
};

/**
 * Searches the description column of live rows for an agent. Skill hits must
 * be enabled; reference hits must belong to an enabled skill.
 */
export async function searchSkillsByDescription(
  query: string,
  agentId: string = DEFAULT_AGENT_ID,
  limit = 10,
): Promise<SkillSearchHit[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  // No ESCAPE clause: Postgres' default LIKE escape character is already the
  // backslash that escapeLikePattern emits.
  const pattern = `%${escapeLikePattern(trimmed)}%`;
  const { rows } = await getPool().query<
    Pick<SkillRow, "id" | "parent_id" | "type" | "name" | "description">
  >(
    `select s.id, s.parent_id, s.type, s.name, s.description
     from agent_skills s
     left join agent_skills parent
       on parent.id = s.parent_id and parent.agent_id = s.agent_id
     where s.agent_id = $1
       and s.deleted_at is null
       and s.description ilike $2
       and (
         (s.type = 'skill' and s.is_enabled)
         or (s.type = 'reference' and parent.deleted_at is null and parent.is_enabled)
       )
     order by (s.type = 'skill') desc, s.name asc
     limit $3`,
    [agentId, pattern, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    skillId: row.parent_id,
  }));
}

export async function createSkill(input: CreateSkillInput) {
  const name = parseName(input.name);
  const description = parseDescription(input.description);
  const body = parseBody(input.body);
  const references = (input.references ?? []).map(parseReferenceInput);

  const id = randomUUID();
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query(
      `insert into agent_skills (id, agent_id, type, name, description, body)
       values ($1, $2, 'skill', $3, $4, $5)`,
      [id, DEFAULT_AGENT_ID, name, description, body],
    );

    for (const reference of references) {
      await client.query(
        `insert into agent_skills (id, agent_id, parent_id, type, name, description, body)
         values ($1, $2, $3, 'reference', $4, $5, $6)`,
        [randomUUID(), DEFAULT_AGENT_ID, id, reference.name, reference.description, reference.body],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw translateDbError(error, name);
  } finally {
    client.release();
  }

  return requireSkill(id);
}

export async function updateSkill(id: string, input: UpdateSkillInput) {
  const existing = await requireSkill(id);

  const name = input.name === undefined ? existing.name : parseName(input.name);
  const description =
    input.description === undefined ? existing.description : parseDescription(input.description);
  const body = input.body === undefined ? existing.body : parseBody(input.body);
  const isEnabled = input.isEnabled === undefined ? existing.isEnabled : input.isEnabled;
  const references = input.references?.map(parseReferenceInput);

  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query(
      `update agent_skills
       set name = $2, description = $3, body = $4, is_enabled = $5, updated_at = now()
       where id = $1 and type = 'skill' and deleted_at is null`,
      [id, name, description, body, isEnabled],
    );

    if (references) {
      const liveIds = new Set(existing.references.map((reference) => reference.id));
      const keptIds = new Set<string>();

      for (const reference of references) {
        if (reference.id) {
          if (!liveIds.has(reference.id)) {
            throw new SkillInputError(`Reference '${reference.id}' does not belong to this skill.`);
          }

          keptIds.add(reference.id);
          await client.query(
            `update agent_skills
             set name = $2, description = $3, body = $4, updated_at = now()
             where id = $1 and parent_id = $5 and deleted_at is null`,
            [reference.id, reference.name, reference.description, reference.body, id],
          );
        } else {
          await client.query(
            `insert into agent_skills (id, agent_id, parent_id, type, name, description, body)
             values ($1, $2, $3, 'reference', $4, $5, $6)`,
            [
              randomUUID(),
              DEFAULT_AGENT_ID,
              id,
              reference.name,
              reference.description,
              reference.body,
            ],
          );
        }
      }

      const removedIds = [...liveIds].filter((liveId) => !keptIds.has(liveId));

      if (removedIds.length > 0) {
        await client.query(
          `update agent_skills
           set deleted_at = now(), updated_at = now()
           where parent_id = $1 and id = any($2::uuid[]) and deleted_at is null`,
          [id, removedIds],
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw translateDbError(error, name);
  } finally {
    client.release();
  }

  return requireSkill(id);
}

/** Soft delete only: stamps deleted_at on the skill and its live references. */
export async function deleteSkill(id: string) {
  await requireSkill(id);

  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query(
      `update agent_skills
       set deleted_at = now(), updated_at = now()
       where (id = $1 or parent_id = $1) and deleted_at is null`,
      [id],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// --- Internals ---------------------------------------------------------------

function escapeLikePattern(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

async function requireSkill(id: string) {
  const skill = await getSkillById(id);

  if (!skill) {
    throw new SkillNotFoundError(id);
  }

  return skill;
}

function parseName(value: string) {
  const name = value?.trim() ?? "";
  const error = validateName(name);

  if (error) {
    throw new SkillInputError(error);
  }

  return name;
}

function parseDescription(value: string) {
  const description = value?.trim() ?? "";
  const error = validateDescription(description);

  if (error) {
    throw new SkillInputError(error);
  }

  return description;
}

function parseBody(value: string) {
  const body = value?.trim() ?? "";
  const error = validateSkillBody(body);

  if (error) {
    throw new SkillInputError(error);
  }

  return body;
}

function parseReferenceBody(value: string) {
  const body = value?.trim() ?? "";
  const error = validateReferenceBody(body);

  if (error) {
    throw new SkillInputError(error);
  }

  return body;
}

function parseReferenceInput(input: SkillReferenceInput): Required<SkillReferenceInput> {
  return {
    id: input.id ?? "",
    name: parseName(input.name),
    description: parseDescription(input.description),
    body: parseReferenceBody(input.body),
  };
}

function translateDbError(error: unknown, skillName: string) {
  if (error && typeof error === "object" && "code" in error && error.code === "23505") {
    const constraint = "constraint" in error ? String(error.constraint) : "";

    if (constraint === "agent_skills_reference_name_uniq") {
      return new SkillInputError("Reference names must be unique within a skill.");
    }

    return new SkillInputError(`A skill named '${skillName}' already exists.`);
  }

  return error;
}

function mapSkillRow(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    body: row.body,
    isEnabled: row.is_enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    references: [],
  };
}

function mapReferenceRow(row: SkillRow): SkillReference {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
