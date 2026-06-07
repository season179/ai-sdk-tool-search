import { Pool } from "pg";

import { requireDatabaseUrl } from "@/lib/scheduler/env";

type PoolGlobal = {
  __schedulerPool?: Pool;
};

const globalForPool = globalThis as PoolGlobal;

export function getPool() {
  if (!globalForPool.__schedulerPool) {
    globalForPool.__schedulerPool = new Pool({
      connectionString: requireDatabaseUrl(),
      max: 5,
    });
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
