import { Pool } from "pg";

import { requireDatabaseUrl } from "@/lib/scheduler/env";

type PoolGlobal = {
  __schedulerPool?: Pool;
};

const globalForPool = globalThis as PoolGlobal;

export function getPool() {
  if (!globalForPool.__schedulerPool) {
    const pool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: 5,
      // Bound connect/checkout and statement time so callers' fail-soft paths
      // see a rejection instead of hanging on an unreachable Postgres.
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
    });

    // Idle pooled clients emit 'error' when their backend dies (e.g. Postgres
    // restarts); without a listener the event crashes the process.
    pool.on("error", (error) => {
      console.error("Idle Postgres client error", error);
    });

    globalForPool.__schedulerPool = pool;
  }

  return globalForPool.__schedulerPool;
}

export async function closePool() {
  const pool = globalForPool.__schedulerPool;

  if (!pool) {
    return;
  }

  globalForPool.__schedulerPool = undefined;
  await pool.end();
}
