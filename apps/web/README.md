# WorkWeave Web

The Next.js app is the browser interface for WorkWeave. It provides the workflow canvas, node configuration, credential and account screens, execution history, and live execution logs.

## Local development

From the repository root:

```bash
bun install
bun --cwd apps/web run dev
```

Open `http://localhost:3000`. The web package also has `build`, `start`, `lint`, and `check-types` scripts; run them with `bun --cwd apps/web run <script>`.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Public API base URL; defaults to `http://localhost:8080`. |
| `NEXT_PUBLIC_EXECUTION_WS_URL` | Optional public WebSocket base URL when the default derived URL is not correct. |

Set `WEB_APP_URL` on the API to the exact browser origin, including scheme and port in local development. The API uses credentialed CORS for browser sessions.

## Deployment

Deploy from the monorepo so Next.js can resolve the workspace API types and shared packages. Set the public API and WebSocket URLs at build/runtime as required by your hosting setup. The browser must be able to reach both endpoints, and the API must allow the deployed web origin.
