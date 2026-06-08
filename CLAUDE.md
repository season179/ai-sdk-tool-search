# CLAUDE.md

## What this is

A Next.js App Router experiment ("ai-sdk-tool-search") proving a tool-search pattern: an agent uses a large tool registry WITHOUT sending every tool schema each turn. A 3-tool BM25 bridge fronts ~200 mock tools + 6 real scheduler tools, with an "all-tools" mode as the token-cost baseline. See [README.md](README.md) / [PRODUCT.md](PRODUCT.md) for product framing.

## Commands

Package manager is **pnpm only** (pinned `pnpm@11.5.1`; npm/yarn will mismatch). Tooling is **Biome only** — there is no eslint/prettier.

- `pnpm dev` — starts **Portless**, not Next directly. App is served over HTTPS at **https://auto-tools.localhost** (no port); Next runs on a random underlying port proxied behind it. Never hardcode `localhost:3000`.
- `pnpm dev:app` — raw `next dev` (random port), only for debugging the proxy.
- `pnpm lint` — `biome check .` (read-only; the CI/verify gate). `pnpm format` — `biome check --write .` (also reorders imports). `pnpm typecheck` — `tsc --noEmit` (Biome does not type-check).
- `docker compose up -d` — Postgres 17 on **host port 5433** (creds all literal `auto_tools`).
- `pnpm db:migrate` — applies [db/migrations/*.sql](db/migrations) (creates the app tables only). Requires `DATABASE_URL`.
- `pnpm worker:scheduled-tasks` — the pg-boss worker. **Must run as a separate process**; `pnpm dev` does NOT start it.

## Architecture

**Tool-search bridge** ([lib/tool-search.ts](lib/tool-search.ts), [app/api/chat/route.ts](app/api/chat/route.ts)): The "deferral" is NOT the AI SDK's native deferred-tool mechanism. In search mode the model receives ONLY 3 generic tools — `tool_search` / `tool_describe` / `tool_call`. The 206-tool catalog schemas are simply never put in the request payload; the model discovers a name via search, fetches its params via describe, then invokes `{name, arguments}` through `tool_call`. `tool_call` uses `additionalProperties:true`, so args are NOT validated at the bridge — only the executor checks the name exists. Catalog = union of 200 mock specs ([lib/mock-tools.ts](lib/mock-tools.ts)) + 6 real scheduler specs ([lib/scheduler/tool-specs.ts](lib/scheduler/tool-specs.ts)). BM25 is hand-rolled with a substring fallback. `TOOL_EXPOSURE_MODE` only matters as the literal `all` (case-insensitive); anything else → `search`. In `all` mode all 206 tools are sent directly and the bridge is never created.

**Scheduler** ([lib/scheduler](lib/scheduler), [workers/scheduled-tasks.ts](workers/scheduled-tasks.ts)): Two-schema split — the app owns `agent_scheduled_tasks` + `agent_scheduled_task_runs` (created by `db:migrate`), pg-boss owns its own `pgboss` schema (created lazily on `boss.start()`, NOT by the migration). Linked only by IDs across the boundary; a pg-boss job carries just `{ taskId }`. `once` vs `cron` use different pg-boss APIs and columns: `once` → `boss.sendAfter` (run_at hardcoded UTC, timezone ignored); `cron` → `boss.schedule` (honors IANA tz). `getBoss()` in API routes starts the queue but does NOT process jobs — without the worker running, jobs enqueue but never fire. Payload is a discriminated union (`kind:'tool_call'`) designed to extend without migration (jsonb). Standalone entrypoints (worker, scripts) rely on side-effect import [lib/scheduler/load-env.ts](lib/scheduler/load-env.ts); Next loads its own env, so app code must NOT import it.

**REST + UI**: Scheduled-tasks REST verbs ([app/api/scheduled-tasks](app/api/scheduled-tasks)): GET/POST on the collection; DELETE=cancel and PATCH=pause/resume action-dispatcher on `[id]`; GET runs history. No PUT, no field-edit endpoint. `[id]` params are a `Promise` (Next 15 async params) — must be awaited. The chat UI ([app/page.tsx](app/page.tsx)) is one big `'use client'` component hitting `/api/chat`; the only consumer of the scheduled-tasks API is [components/tasks-panel.tsx](components/tasks-panel.tsx).

## Gotchas

- **Env**: `OPENROUTER_API_KEY` + `OPENROUTER_DEFAULT_MODEL` are required for chat (500 before streaming if missing). `DATABASE_URL` required for scheduler/worker/migrations. Optional with defaults: `TOOL_EXPOSURE_MODE` (search), `PGBOSS_SCHEMA` (pgboss), `DEFAULT_SCHEDULE_TIMEZONE` (UTC). See [.env.example](.env.example).
- [lib/mock-tools.ts](lib/mock-tools.ts) throws at import if there aren't exactly 200 specs — adding/removing a mock tool crashes the module unless you update the guard.
- A scheduled task's tool must exist in the mock catalog at create time AND run time; removing it breaks pending tasks. Scheduler tools themselves cannot be scheduled.
- **All token figures are estimates** (chars/4 heuristic). The `all`-mode baseline assumes the full catalog is resent on every loop step, so `savedSchemaTokens` overstates real savings. `x-mock-tools` is always 200 (excludes the 6 scheduler tools); `x-total-tools` = 3 (search) or 206 (all).
- The worker **rethrows** after `markRunFailed` on purpose so pg-boss applies retry (retryLimit 2) + DLQ. Swallowing the error silently disables both.
- Every 500 from the scheduler REST API reports a hardcoded "Postgres/DATABASE_URL" message ([app/api/scheduled-tasks/_errors.ts](app/api/scheduled-tasks/_errors.ts)) regardless of actual cause — misleading when debugging non-DB failures. `executeSchedulerTool` also catches DB-unavailable and returns `{success:false}` rather than throwing, so failures are silent at the model layer.
- [app/globals.css](app/globals.css) must keep BOTH the streamdown CSS import and `@source ".../streamdown/dist/*.js"` — dropping the `@source` silently breaks markdown styling under Tailwind v4.
- Path alias `@/*` resolves to the repo **root** (no `src/` dir). [components/ui/button.tsx](components/ui/button.tsx) is a plain `<button>` (no Radix `asChild`).
