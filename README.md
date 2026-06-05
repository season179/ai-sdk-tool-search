# OpenRouter Streaming Chat

A small Next.js App Router chatbot using TypeScript, React 19, Tailwind CSS 4, AI Elements-style components, and the Vercel AI SDK with OpenRouter.

## Setup

1. Use pnpm 11. This repo pins `packageManager` to `pnpm@11.5.1`.
2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create `.env` from `.env.example` and fill both values:

   ```bash
   OPENROUTER_API_KEY=...
   OPENROUTER_DEFAULT_MODEL=...
   TOOL_EXPOSURE_MODE=search
   ```

   `OPENROUTER_DEFAULT_MODEL` is used directly as the chat model. The app intentionally fails with a clear server error if either variable is missing.
   `TOOL_EXPOSURE_MODE` is optional. `search` sends only the tool-search bridge tools; `all` sends every mock-backed tool schema for baseline comparison.

4. Start the app:

   ```bash
   pnpm dev
   ```

5. Open `https://auto-tools.localhost` and send a message.

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
