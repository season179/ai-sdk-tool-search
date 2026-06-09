/**
 * Validation rules shared by the API (lib/skills/skills.ts) and the skills
 * page form. Pure functions only — this module runs in both server and
 * client bundles.
 *
 * The rules mirror the Agent Skills spec (agentskills.io) and the check
 * constraints in db/migrations/002_skills.sql.
 */

export const NAME_MAX = 64;
export const DESCRIPTION_MAX = 1024;
export const SKILL_BODY_MAX_CHARS = 25000;
export const SKILL_BODY_MAX_LINES = 500;

/** Lowercase alphanumeric segments separated by single hyphens. */
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function countLines(value: string) {
  return value.length === 0 ? 0 : value.split("\n").length;
}

/** Returns an error message, or null when the name is valid. */
export function validateName(name: string): string | null {
  if (name.length === 0) {
    return "Name is required.";
  }

  if (name.length > NAME_MAX) {
    return `Name must be ${NAME_MAX} characters or fewer.`;
  }

  if (name.startsWith("-") || name.endsWith("-")) {
    return "Name must not start or end with a hyphen.";
  }

  if (name.includes("--")) {
    return "Name must not contain consecutive hyphens.";
  }

  if (!NAME_PATTERN.test(name)) {
    return "Name may only contain lowercase letters (a-z), digits (0-9), and hyphens.";
  }

  return null;
}

/** Returns an error message, or null when the description is valid. */
export function validateDescription(description: string): string | null {
  if (description.length === 0) {
    return "Description is required.";
  }

  if (description.length > DESCRIPTION_MAX) {
    return `Description must be ${DESCRIPTION_MAX} characters or fewer.`;
  }

  return null;
}

/**
 * Returns an error message, or null when the body is valid. The line and
 * character limits apply to skill instructions only ('skill' rows), not to
 * reference content.
 */
export function validateSkillBody(body: string): string | null {
  if (body.length === 0) {
    return "Instructions are required.";
  }

  if (body.length > SKILL_BODY_MAX_CHARS) {
    return `Instructions must be ${SKILL_BODY_MAX_CHARS.toLocaleString()} characters or fewer.`;
  }

  if (countLines(body) > SKILL_BODY_MAX_LINES) {
    return `Instructions must be ${SKILL_BODY_MAX_LINES} lines or fewer.`;
  }

  return null;
}

/** Returns an error message, or null when the reference body is valid. */
export function validateReferenceBody(body: string): string | null {
  if (body.length === 0) {
    return "Reference content is required.";
  }

  return null;
}
