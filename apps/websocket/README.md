# websocket

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/index.ts
```

Environment variables (loaded from the repository root `.env`):

- `EXECUTION_STREAM_SIGNING_SECRET` (required) — must match the API signer.
- `REALTIME_HOST` / `REALTIME_PORT` (optional, defaults `::` / `3101`).
- `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` (for the pub/sub stream).

Health check: `GET /health`. Stream endpoint: `WS /ws/executions?token=<signed token>`.

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
