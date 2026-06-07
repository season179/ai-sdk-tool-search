import { PgBoss } from "pg-boss";

import { getPgBossSchema, requireDatabaseUrl } from "@/lib/scheduler/env";

export const TASK_QUEUE_NAME = "agent-task-run";
export const TASK_DLQ_NAME = "agent-task-run-dlq";

type BossGlobal = {
  __schedulerBoss?: {
    boss: PgBoss;
    started: Promise<PgBoss>;
  };
};

const globalForBoss = globalThis as BossGlobal;

function createBoss() {
  const boss = new PgBoss({
    connectionString: requireDatabaseUrl(),
    schema: getPgBossSchema(),
  });

  boss.on("error", (error) => {
    console.error("pg-boss error", error);
  });
  boss.on("warning", (warning) => {
    console.warn("pg-boss warning", warning);
  });

  return boss;
}

async function startAndPrepare(boss: PgBoss) {
  await boss.start();
  await boss.createQueue(TASK_DLQ_NAME, {
    retentionSeconds: 14 * 24 * 60 * 60,
  });
  await boss.createQueue(TASK_QUEUE_NAME, {
    deadLetter: TASK_DLQ_NAME,
    expireInSeconds: 5 * 60,
    retryBackoff: true,
    retryDelay: 5,
    retryLimit: 2,
  });

  return boss;
}

/**
 * Get the process-wide pg-boss instance, starting it on first call. Safe to
 * call from request handlers and the worker alike; the schema and queues are
 * created on first start. The instance is cached on globalThis so Next.js dev
 * hot reloads do not leak connections.
 */
export function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.__schedulerBoss) {
    const boss = createBoss();
    globalForBoss.__schedulerBoss = {
      boss,
      started: startAndPrepare(boss).catch((error) => {
        globalForBoss.__schedulerBoss = undefined;
        throw error;
      }),
    };
  }

  return globalForBoss.__schedulerBoss.started;
}

export async function stopBoss(options?: { graceful?: boolean }) {
  const entry = globalForBoss.__schedulerBoss;

  if (!entry) {
    return;
  }

  globalForBoss.__schedulerBoss = undefined;
  await entry.started.catch(() => undefined);
  await entry.boss.stop({ graceful: options?.graceful ?? true });
}
