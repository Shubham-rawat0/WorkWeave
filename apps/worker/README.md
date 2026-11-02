# WorkWeave Worker

The worker consumes workflow jobs from BullMQ, loads workflow configuration and credentials from PostgreSQL, executes nodes, and records node and run results. It publishes progress events through Redis so the WebSocket service can stream them to the UI. A scheduler in the same process queues time-based triggers.

## Local development

From the repository root:

```bash
bun install
bun --cwd apps/worker run src/index.ts
```

Or from `apps/worker`, run `bun src/index.ts`. The process waits for Redis to become ready before it starts consuming jobs. Run it in a separate terminal from the API, web, and WebSocket services.

## Environment

The worker loads the repository-root `.env`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used for workflow and run data. |
| `REDIS_URL` | Authenticated Upstash native TCP/TLS URL (`rediss://...upstash.io:6379`). |
| `ENCRYPTION_KEY` | Must match the API’s key to decrypt saved integration credentials. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | Optional provider keys for workflows using those AI providers. |

Additional integration nodes may use credentials saved through the UI or integration-specific configuration. Keep encryption and Redis credentials private; never commit `.env`.

## Runtime behavior

The worker is a persistent background process and does not expose a public HTTP endpoint. If it stops, queued jobs remain pending until it reconnects. Failed jobs use the queue’s configured retry policy. Run one worker process for a small deployment; multiple workers can process separate jobs, while shared locks protect run coordination.
