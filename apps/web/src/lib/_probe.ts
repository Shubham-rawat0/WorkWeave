import type { AppType } from "@WorkOrchestrator/api";
import { hc } from "hono/client";
import type { AppType as AT } from "@WorkOrchestrator/api";

const bad = hc<number>("http://x");
void bad;

const client = hc<AT>("http://x");

const client2 = hc<AT>("http://x", {
  init: { credentials: "include" },
});

declare const _cAuth: typeof client2.auth.me.$get;
declare const _cWorkflow: typeof client.index.$get;
const _clientProbe: unknown = client;
const _let: () => Promise<unknown> = client2.auth.me.$get;
export { _clientProbe, _let, _cAuth, _cWorkflow };

type ClientShape = typeof client;

// force a compile-time display
declare const _k: ClientShape;
export { _k };