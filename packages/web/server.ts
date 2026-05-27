import { Hono } from "hono";
import { serveStatic } from "hono/bun";

// Load .env if DATABASE_URL not already injected by platform
if (!process.env.DATABASE_URL) {
  const fs = await import("fs");
  const path = await import("path");
  const envPath = path.resolve(import.meta.dir, "../../.env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const { default: app } = await import("./src/api/index");

const server = new Hono();
server.route("/", app);
server.use("/assets/*", serveStatic({ root: "./packages/web/dist" }));
server.use("/favicon.ico", serveStatic({ path: "./packages/web/dist/favicon.ico" }));
server.get("*", serveStatic({ path: "./packages/web/dist/index.html" }));

// Use PORT from env (set by platform), fallback to 3000
const preferredPort = Number(process.env.PORT) || 3000;

let s;
try {
  s = Bun.serve({ port: preferredPort, fetch: server.fetch });
} catch {
  // Port in use (e.g. dev server running) — let OS pick a free one
  s = Bun.serve({ port: 0, fetch: server.fetch });
}

console.log(`Server running on http://localhost:${s.port}`);
