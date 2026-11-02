# WorkWeave

WorkWeave is a visual workflow automation platform. Connect triggers, conditions, and actions in a reusable workflow, then run it manually or let a schedule or webhook start it. Each run records node-level status, output, and errors; background jobs can retry failures, and live events appear in the UI.

## Product preview

![WorkWeave start page](packages/shared/src/assets/Screenshot%20(52).png)

### Dashboard

![WorkWeave dashboard](packages/shared/src/assets/Screenshot%20(53).png)

### Execution and history

![WorkWeave execution and history](packages/shared/src/assets/Screenshot%20(54).png)

### Workflow builder

![WorkWeave workflow builder](packages/shared/src/assets/Screenshot%20(55).png)

### AI agent

![WorkWeave AI agent](packages/shared/src/assets/Screenshot%20(56).png)

### Credential management

![WorkWeave credential management](packages/shared/src/assets/Screenshot%20(57).png)

## Features

- Visual canvas for designing workflows from trigger, logic, and action nodes.
- Credential storage for connected services and AI providers.
- Manual, scheduled, and webhook-triggered workflow runs.
- Persistent execution history, node results, retries, and failure details.
- Live execution status and events streamed to the browser.

## Services

| Path | Role |
| --- | --- |
| `apps/web` | Next.js application for workflow editing, accounts, credentials, and execution views. |
| `apps/api` | Hono API for authentication, application data, webhook endpoints, and queueing runs. |
| `apps/worker` | BullMQ worker for workflow execution and scheduled triggers. |
| `apps/websocket` | Token-authenticated WebSocket server for live execution updates. |
| `packages/db` | Prisma schema, generated client, and PostgreSQL migrations. |
| `packages/shared` | Shared workflow types, node definitions, validation, Redis helpers, and screenshots. |

PostgreSQL stores durable application and run data. Redis provides the BullMQ queue, coordination locks, and pub/sub used for live events. The API, worker, and WebSocket server are separate long-running processes.

## Requirements and setup

- Bun `1.3.14` and Node.js `24` or newer.
- PostgreSQL, configured through `DATABASE_URL`.
- An authenticated Upstash native Redis TCP/TLS URL in `REDIS_URL`, such as `rediss://default:<password>@<database>.upstash.io:6379`. REST URL/token credentials are not a substitute for this connection.
- Required application secrets in the root `.env`; see each service guide for details.

Install dependencies from the repository root:

```bash
bun install
```

Generate the Prisma client and apply the schema using the repository’s Prisma package scripts:

```bash
bun --filter @WorkOrchestrator/prisma generate
bun --filter @WorkOrchestrator/prisma push
```

Start each service in its own terminal from the repository root:

```bash
bun --filter @WorkOrchestrator/web dev
bun --cwd apps/api run src/index.ts
bun --cwd apps/worker run src/index.ts
bun --cwd apps/websocket run src/index.ts
```

Only the web app currently defines a `dev` task for `bun run dev`; run the API, worker, and WebSocket commands separately as shown. The web app defaults to `http://localhost:3000`, API to port `8080`, and WebSocket server to port `3101`. Configure the browser-visible API/WebSocket URLs and the API’s allowed `WEB_APP_URL` when using different hosts. The API and WebSocket service must share `EXECUTION_STREAM_SIGNING_SECRET`.

## Deployment notes

Deploy the UI and each backend process according to its runtime needs: the API and WebSocket server accept connections, while the worker must stay running to process queued jobs. All services need access to the correct shared database, Redis URL, and related secrets. Free hosting plans may sleep or disallow persistent background workers; queued workflows and live events depend on those processes being available.

See the service guides: [Web](apps/web/README.md), [API](apps/api/README.md), [Worker](apps/worker/README.md), and [WebSocket](apps/websocket/README.md).
