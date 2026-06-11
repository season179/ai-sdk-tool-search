import { NAME_MAX } from "@/lib/skills/validation";

/**
 * Parsing for the composer's /skill-name command (user-explicit activation
 * per the Agent Skills client guide, step 4). Pure functions only — the
 * composer uses them to tag outgoing messages and drive autocomplete, and
 * the chat route uses them to verify the tag against the message text.
 */

/** A leading /skill-name followed by whitespace or end of message. */
const COMMAND_PATTERN = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/;

/** A command still being typed: slash plus a partial name, nothing after it. */
const PARTIAL_COMMAND_PATTERN = /^\/([a-z0-9-]*)$/;

/** Returns the skill name of a leading /skill-name command, or null. */
export function parseSkillCommand(text: string): string | null {
  const name = COMMAND_PATTERN.exec(text)?.[1];

  return name && name.length <= NAME_MAX ? name : null;
}

/**
 * Returns the partial name while the user is still typing a command (for
 * autocomplete), or null once the text stops looking like one.
 */
export function parsePartialSkillCommand(text: string): string | null {
  const name = PARTIAL_COMMAND_PATTERN.exec(text)?.[1];

  return name !== undefined && name.length <= NAME_MAX ? name : null;
}
