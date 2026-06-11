# OpenRouter Streaming Chat

A small Next.js App Router chatbot using TypeScript, React 19, Tailwind CSS 4, AI Elements-style components, and the Vercel AI SDK with OpenRouter.

## Setup

1. Use pnpm 11. This repo pins `packageManager` to `pnpm@11.5.1`.
2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create `.env` from `.env.example` and fill the OpenRouter values:

   ```bash
   OPENROUTER_API_KEY=...
   OPENROUTER_DEFAULT_MODEL=...
   TOOL_EXPOSURE_MODE=search

   DATABASE_URL=postgres://ai_sdk_app:ai_sdk_app@localhost:5433/ai_sdk_app
   PGBOSS_SCHEMA=pgboss
   DEFAULT_SCHEDULE_TIMEZONE=UTC
   ```

   `OPENROUTER_DEFAULT_MODEL` is used directly as the chat model. The app intentionally fails with a clear server error if either variable is missing.
   `TOOL_EXPOSURE_MODE` is optional. `search` sends only the tool-search bridge tools; `all` sends every mock-backed tool schema for baseline comparison.
   The `DATABASE_URL` block is only needed for scheduled tasks; the defaults match `docker-compose.yml`.

4. Start Postgres, run migrations, and start the scheduled-task worker (only needed for scheduled tasks):

   ```bash
   docker compose up -d
   pnpm db:migrate
   pnpm worker:scheduled-tasks
   ```

5. Start the app:

   ```bash
   pnpm dev
   ```

6. Open `https://ai-sdk-app.localhost` and send a message.

`pnpm dev` runs through Portless and serves the app at a stable HTTPS `.localhost` URL. Portless assigns the underlying Next.js process a random app port, so this project does not need to reserve `3000` or `3001`.

If you need to bypass Portless while debugging, run the raw Next.js server with:

```bash
pnpm run dev:app
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm build
```

The `/api/chat` route uses `ToolLoopAgent` with `createAgentUIStreamResponse()`. By default it exposes a local BM25 tool-search bridge over 200 partially real mock-backed tools, and returns `x-openrouter-model`, `x-mock-tools`, `x-total-tools`, and `x-tool-exposure-mode` response headers for local verification.

## Scheduled Tasks

The agent has six real (pg-boss-backed) scheduler tools in the same catalog: `scheduled_task_create`, `scheduled_task_list`, `scheduled_task_cancel`, `scheduled_task_pause`, `scheduled_task_resume`, and `scheduled_task_get_runs`. Tasks run a stored catalog tool call (`payload.kind = 'tool_call'`) either once (`run_at`) or on a cron schedule with an IANA timezone.

- Architecture and decisions: `docs/pg-boss-scheduled-tasks-plan.md`
- App state lives in `agent_scheduled_tasks` / `agent_scheduled_task_runs`; pg-boss owns queue state in the `pgboss` schema.
- The worker (`pnpm worker:scheduled-tasks`) must be running for tasks to execute. Failed runs retry twice with backoff, then land in the `agent-task-run-dlq` queue.
- The header Tasks panel and `GET/POST /api/scheduled-tasks`, `PATCH/DELETE /api/scheduled-tasks/:id`, `GET /api/scheduled-tasks/:id/runs` use the same service as the chat tools.
- `scripts/smoke-scheduler.ts` is a quick end-to-end check (requires Postgres and the worker).
