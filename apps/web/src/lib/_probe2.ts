import { Hono } from "hono";
import { hc } from "hono/client";

const mini = new Hono().get("/x", (c) => c.json({ a: 1 }));

const m = hc<typeof mini>("http://y");

const _p: unknown = m.x.$get;
export { _p };