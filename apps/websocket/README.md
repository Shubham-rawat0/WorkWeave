# WorkWeave WebSocket Service

This service delivers live workflow updates to the browser. It subscribes to Redis pub/sub channels written by the worker and streams workflow and node status, output, and error events to clients holding a short-lived signed token from the API.

## Local development

From the repository root:

```bash
bun install
bun --cwd apps/websocket run src/index.ts
```

Or from `apps/websocket`, run `bun src/index.ts`. The service listens on port `3101` by default.

- Health check: `GET http://localhost:3101/health`
- Stream: `ws://localhost:3101/ws/executions?token=<signed-token>`

## Environment

| Variable | Purpose |
| --- | --- |
| `REDIS_URL` | Authenticated Upstash native TCP/TLS URL (`rediss://...upstash.io:6379`), shared with API and worker. |
| `EXECUTION_STREAM_SIGNING_SECRET` | Must match the API’s signing secret. |
| `REALTIME_HOST` | Listen host; defaults to `::`. |
| `REALTIME_PORT` | Listen port; defaults to `PORT` if set, otherwise `3101`. |

The service loads the repository-root `.env` when run from the monorepo. Set the API’s `EXECUTION_WS_URL` and the web app’s `NEXT_PUBLIC_EXECUTION_WS_URL` to the public WebSocket base URL when the default URL does not match the deployed topology. Use `wss://` behind TLS termination.

## Security and deployment

The API signs run-specific stream tokens and the WebSocket service verifies them before subscribing to a run channel. Keep the signing secret private and identical across the API and WebSocket service. Expose this service publicly through a host or proxy that supports WebSocket upgrades; keep Redis private and accessible to the service over TLS.
