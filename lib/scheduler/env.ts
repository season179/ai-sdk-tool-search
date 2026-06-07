export class MissingSchedulerEnvironmentError extends Error {
  constructor(readonly variableName: "DATABASE_URL") {
    super(`${variableName} is required before scheduled tasks can be used.`);
    this.name = "MissingSchedulerEnvironmentError";
  }
}

export function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new MissingSchedulerEnvironmentError("DATABASE_URL");
  }

  return value;
}

export function getPgBossSchema() {
  return process.env.PGBOSS_SCHEMA?.trim() || "pgboss";
}

export function getDefaultScheduleTimezone() {
  return process.env.DEFAULT_SCHEDULE_TIMEZONE?.trim() || "UTC";
}
