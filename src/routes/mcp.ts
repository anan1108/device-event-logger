import { Hono } from "hono";
import type { Env, Vars } from "../types.js";
import { handleMcpPost } from "../lib/mcp-protocol.js";

const mcp = new Hono<{ Bindings: Env; Variables: Vars }>();

mcp.post("/", handleMcpPost);

mcp.all("/", (c) => {
  c.header("Allow", "POST, OPTIONS");
  return c.json({ error: "Method not allowed" }, 405);
});

export { mcp };
