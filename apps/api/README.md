# WorkWeave API

The Hono API handles authentication and sessions, workflow and credential management, webhook delivery, AI agent requests, and execution scheduling. It persists a run in PostgreSQL and enqueues a BullMQ job in Redis; the worker performs the actual execution. The API also creates signed tokens for live execution streams.

## Local development

From the repository root:

```bash
bun install
bun --cwd apps/api run src/index.ts
```

The server reads `PORT` and defaults to `8080`. Routes are mounted under `/api/v1`. The API package exposes a Hono app for workspace type sharing; `src/index.ts` is its Bun server entrypoint.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `REDIS_URL` | Authenticated Upstash native TCP/TLS URL (`rediss://...upstash.io:6379`); required for queueing runs. |
| `WEB_APP_URL` | Browser origin allowed by credentialed CORS; defaults locally to `http://localhost:3000`. |
| `BETTER_AUTH_SECRET` | Authentication and reset-token secret; execution signing can fall back to it. |
| `ENCRYPTION_KEY` | Encrypts stored credentials; use the same value in the worker. |
| `EXECUTION_STREAM_SIGNING_SECRET` | Signs live stream tokens; set it to the same value in the WebSocket service. |
| `API_URL` | Public API base URL embedded in generated inbound webhook URLs. |
| `EXECUTION_WS_URL` | Public WebSocket base URL returned to the UI when needed. |

Password-reset email additionally requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. Configure provider API keys for AI routes when using them.

If `EXECUTION_STREAM_SIGNING_SECRET` is unset, the API can use as a fallback; configure the WebSocket service with the exact same effective secret. The web app sends credentialed requests, so set `WEB_APP_URL` to the browser origin rather than the API URL.

## Database changes

Prisma schema and migrations are in `packages/db`. Set `DATABASE_URL` before running database commands. Generate the client after schema changes and apply the corresponding migration before deploying application code that depends on it. For local schema sync, the workspace scripts are `bun --filter @WorkOrchestrator/prisma generate` and `bun --filter @WorkOrchestrator/prisma push`.

## Deployment

Run the API as a persistent web process with a reachable `PORT`. Configure public `API_URL`, `WEB_APP_URL`, and `EXECUTION_WS_URL` for deployed origins. Share Redis and signing/encryption secrets with the worker and WebSocket service as indicated above.
