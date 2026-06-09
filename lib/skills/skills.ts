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
  // Per the Agent Skills spec, metadata is a map of string keys to string
  // values. Untrusted inputs are checked by validateMetadata before persistence.
  metadata: Record<string, string> | null;
  version: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Number of attached skill resources. Only populated by list queries that
   * join the resources table (e.g. `listAllSkills`); `undefined` otherwise.
   */
  resourceCount?: number;
};

// --- Error classes ----------------------------------------------------------

export class SkillsInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillsInputError";
  }
}

export class SkillNotFoundError extends Error {
  constructor(id: string) {
    super(`Skill not found: ${id}`);
    this.name = "SkillNotFoundError";
  }
}

export class SkillDuplicateNameError extends Error {
  constructor(name: string) {
    super(`A skill with name '${name}' already exists.`);
    this.name = "SkillDuplicateNameError";
  }
}

export class SkillResourceNotFoundError extends Error {
  constructor(id: string) {
    super(`Skill resource not found: ${id}`);
    this.name = "SkillResourceNotFoundError";
  }
}

export class SkillResourceDuplicatePathError extends Error {
  constructor(path: string) {
    super(`A resource with path '${path}' already exists for this skill.`);
    this.name = "SkillResourceDuplicatePathError";
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
  resource_count?: string | number | null;
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

/**
 * The Agent Skills spec defines `metadata` as a map from string keys to string
 * values. null/undefined means "no metadata"; anything else must be a plain
 * object whose every value is a string.
 */
export function validateMetadata(metadata: unknown): void {
  if (metadata === undefined || metadata === null) {
    return;
  }

  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new SkillsInputError(
      "Skill metadata must be a JSON object mapping string keys to string values.",
    );
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value !== "string") {
      throw new SkillsInputError(
        `Skill metadata value for '${key}' must be a string (metadata is a string-to-string map).`,
      );
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

export function validateResourceContent(input: { contentType?: unknown; body?: unknown }): void {
  if (input.contentType !== undefined && typeof input.contentType !== "string") {
    throw new SkillsInputError("Resource contentType must be a string.");
  }

  if (input.body !== undefined && typeof input.body !== "string") {
    throw new SkillsInputError("Resource body must be a string.");
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

export async function getEnabledSkillsResourceChars(): Promise<number> {
  const { rows } = await getPool().query<{ total: string | null }>(
    `select coalesce(sum(length(r.body)), 0) as total
     from agent_skill_resources r
     join agent_skills s on s.id = r.skill_id
     where s.enabled = true`,
  );

  return Number(rows[0]?.total ?? 0);
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

// Column list shared by every single-table resource query (keeps mapSkillResourceRow in sync).
const RESOURCE_COLUMNS = "id, skill_id, path, content_type, body, created_at, updated_at";

export async function listSkillResourcesBySkillId(skillId: string): Promise<SkillResource[]> {
  const { rows } = await getPool().query<SkillResourceRow>(
    `select ${RESOURCE_COLUMNS}
     from agent_skill_resources
     where skill_id = $1
     order by path`,
    [skillId],
  );

  return rows.map(mapSkillResourceRow);
}

export async function getSkillResourceById(resourceId: string): Promise<SkillResource> {
  const { rows } = await getPool().query<SkillResourceRow>(
    `select ${RESOURCE_COLUMNS}
     from agent_skill_resources
     where id = $1`,
    [resourceId],
  );

  if (rows.length === 0) {
    throw new SkillResourceNotFoundError(resourceId);
  }

  return mapSkillResourceRow(rows[0]);
}

export async function createSkillResource(input: {
  skillId: string;
  path: string;
  contentType?: string;
  body?: string;
}): Promise<SkillResource> {
  validateResourcePath(input.path);
  validateResourceContent(input);

  // The schema enforces the FK to agent_skills and the unique (skill_id, path)
  // constraint, so a single INSERT is atomic — no TOCTOU pre-check needed. Map the
  // two reachable violations to friendly errors instead of leaking a raw PG error.
  try {
    const { rows } = await getPool().query<SkillResourceRow>(
      `insert into agent_skill_resources (skill_id, path, content_type, body)
       values ($1, $2, $3, $4)
       returning ${RESOURCE_COLUMNS}`,
      [input.skillId, input.path, input.contentType ?? "text/markdown", input.body ?? ""],
    );

    return mapSkillResourceRow(rows[0]);
  } catch (error) {
    if (isPgError(error, "23505")) {
      throw new SkillResourceDuplicatePathError(input.path);
    }
    if (isPgError(error, "23503")) {
      throw new SkillNotFoundError(input.skillId);
    }
    throw error;
  }
}

export async function updateSkillResource(
  skillId: string,
  resourceId: string,
  input: {
    path?: string;
    contentType?: string;
    body?: string;
  },
): Promise<SkillResource> {
  const current = await getSkillResourceById(resourceId);

  // The resource must belong to the skill named in the URL; otherwise it is "not found"
  // for this skill — never silently mutate another skill's resource.
  if (current.skillId !== skillId) {
    throw new SkillResourceNotFoundError(resourceId);
  }

  if (input.path !== undefined) {
    validateResourcePath(input.path);
  }
  validateResourceContent(input);

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.path !== undefined) {
    sets.push(`path = $${idx++}`);
    values.push(input.path);
  }
  if (input.contentType !== undefined) {
    sets.push(`content_type = $${idx++}`);
    values.push(input.contentType);
  }
  if (input.body !== undefined) {
    sets.push(`body = $${idx++}`);
    values.push(input.body);
  }

  if (sets.length === 0) {
    return current;
  }

  sets.push(`updated_at = now()`);
  values.push(resourceId);

  try {
    const { rows } = await getPool().query<SkillResourceRow>(
      `update agent_skill_resources set ${sets.join(", ")} where id = $${idx}
       returning ${RESOURCE_COLUMNS}`,
      values,
    );

    return mapSkillResourceRow(rows[0]);
  } catch (error) {
    if (isPgError(error, "23505")) {
      throw new SkillResourceDuplicatePathError(input.path ?? current.path);
    }
    throw error;
  }
}

export async function deleteSkillResource(
  skillId: string,
  resourceId: string,
): Promise<SkillResource> {
  const resource = await getSkillResourceById(resourceId);

  if (resource.skillId !== skillId) {
    throw new SkillResourceNotFoundError(resourceId);
  }

  await getPool().query(`delete from agent_skill_resources where id = $1`, [resourceId]);

  return resource;
}

export async function listAllSkills(): Promise<Skill[]> {
  const { rows } = await getPool().query<SkillRow>(
    `select s.id, s.name, s.description, s.body, s.license, s.compatibility, s.allowed_tools,
            s.metadata, s.version, s.enabled, s.created_at, s.updated_at,
            count(r.id) as resource_count
     from agent_skills s
     left join agent_skill_resources r on r.skill_id = s.id
     group by s.id
     order by s.name`,
  );

  return rows.map(mapSkillRow);
}

export async function getSkillById(id: string): Promise<Skill> {
  const { rows } = await getPool().query<SkillRow>(
    `select id, name, description, body, license, compatibility, allowed_tools, metadata,
            version, enabled, created_at, updated_at
     from agent_skills
     where id = $1`,
    [id],
  );

  if (rows.length === 0) {
    throw new SkillNotFoundError(id);
  }

  return mapSkillRow(rows[0]);
}

export async function createSkill(input: {
  name: string;
  description: string;
  body?: string;
  license?: string | null;
  compatibility?: string | null;
  allowedTools?: string[] | null;
  metadata?: Record<string, unknown> | null;
  enabled?: boolean;
}): Promise<Skill> {
  // Treat an empty/whitespace-only compatibility as "not provided" (null). The
  // spec requires 1-500 chars *if provided*; coercing "" -> null keeps that
  // invariant without rejecting a field the author simply left blank.
  const compatibility = emptyToNull(input.compatibility);

  validateSkillInput({
    name: input.name,
    description: input.description,
    compatibility,
  });
  validateMetadata(input.metadata);

  // Check for duplicate name
  const existing = await getPool().query(`select id from agent_skills where name = $1`, [
    input.name.trim(),
  ]);
  if (existing.rows.length > 0) {
    throw new SkillDuplicateNameError(input.name.trim());
  }

  const { rows } = await getPool().query<SkillRow>(
    `insert into agent_skills (name, description, body, license, compatibility, allowed_tools, metadata, enabled)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, name, description, body, license, compatibility, allowed_tools, metadata,
               version, enabled, created_at, updated_at`,
    [
      input.name.trim(),
      input.description.trim(),
      input.body ?? "",
      input.license ?? null,
      compatibility,
      // jsonb columns: store SQL NULL when absent, not the jsonb value 'null'.
      // JSON.stringify(null) === '"null"' would be persisted as jsonb null, which
      // is a value (not SQL NULL) and trips the metadata string-map CHECK.
      input.allowedTools == null ? null : JSON.stringify(input.allowedTools),
      input.metadata == null ? null : JSON.stringify(input.metadata),
      input.enabled ?? true,
    ],
  );

  return mapSkillRow(rows[0]);
}

export async function updateSkill(
  id: string,
  input: {
    description?: string;
    body?: string;
    license?: string | null;
    compatibility?: string | null;
    allowedTools?: string[] | null;
    metadata?: Record<string, unknown> | null;
    enabled?: boolean;
  },
): Promise<Skill> {
  // Verify the skill exists
  await getSkillById(id);

  // Coerce an empty/whitespace compatibility to null (see createSkill) before
  // validating or persisting, so clearing the field is allowed but a provided
  // value still honours the 1-500 char rule.
  const compatibility =
    input.compatibility !== undefined ? emptyToNull(input.compatibility) : undefined;

  // Validate if description/compatibility are being updated
  if (input.description !== undefined || compatibility !== undefined) {
    const current = await getSkillById(id);
    validateSkillInput({
      name: current.name,
      description: input.description ?? current.description,
      compatibility: compatibility ?? current.compatibility,
    });
  }
  validateMetadata(input.metadata);

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.description !== undefined) {
    sets.push(`description = $${idx++}`);
    values.push(input.description.trim());
  }
  if (input.body !== undefined) {
    sets.push(`body = $${idx++}`);
    values.push(input.body);
  }
  if (input.license !== undefined) {
    sets.push(`license = $${idx++}`);
    values.push(input.license);
  }
  if (compatibility !== undefined) {
    sets.push(`compatibility = $${idx++}`);
    values.push(compatibility);
  }
  if (input.allowedTools !== undefined) {
    sets.push(`allowed_tools = $${idx++}`);
    // Store SQL NULL when clearing, not the jsonb value 'null' (see createSkill).
    values.push(input.allowedTools == null ? null : JSON.stringify(input.allowedTools));
  }
  if (input.metadata !== undefined) {
    sets.push(`metadata = $${idx++}`);
    values.push(input.metadata == null ? null : JSON.stringify(input.metadata));
  }
  if (input.enabled !== undefined) {
    sets.push(`enabled = $${idx++}`);
    values.push(input.enabled);
  }

  if (sets.length === 0) {
    return getSkillById(id);
  }

  sets.push(`updated_at = now()`);
  values.push(id);

  const { rows } = await getPool().query<SkillRow>(
    `update agent_skills set ${sets.join(", ")} where id = $${idx}
     returning id, name, description, body, license, compatibility, allowed_tools, metadata,
               version, enabled, created_at, updated_at`,
    values,
  );

  return mapSkillRow(rows[0]);
}

export async function deleteSkill(id: string): Promise<Skill> {
  const skill = await getSkillById(id);

  await getPool().query(`delete from agent_skills where id = $1`, [id]);

  return skill;
}

// --- Internals --------------------------------------------------------------

/** Trim a value, returning null when it is absent or empty after trimming. */
function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
}

function mapSkillRow(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    body: row.body,
    license: row.license,
    compatibility: row.compatibility,
    allowedTools: Array.isArray(row.allowed_tools) ? row.allowed_tools : null,
    metadata: isRecord(row.metadata) ? (row.metadata as Record<string, string>) : null,
    version: row.version,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...(row.resource_count == null ? {} : { resourceCount: Number(row.resource_count) }),
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

/**
 * True when `error` is a node-pg error carrying the given SQLSTATE code.
 * Common codes: 23505 unique_violation, 23503 foreign_key_violation,
 * 22P02 invalid_text_representation (e.g. a malformed uuid).
 */
export function isPgError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
