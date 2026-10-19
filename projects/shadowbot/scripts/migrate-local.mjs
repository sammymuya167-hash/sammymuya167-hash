/** Apply immutable Drizzle SQL migrations with a D1-side migration ledger. */
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare } = require("miniflare");
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("migration runner")}}',
  compatibilityDate: "2026-05-15",
  d1Databases: { DB: "00000000-0000-4000-8000-000000000000" },
  d1Persist: resolve(".wrangler/state/v3/d1"),
});
try {
  const db = await mf.getD1Database("DB");
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS shadowbot_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
    )
    .run();
  for (const name of readdirSync("drizzle")
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (
      await db
        .prepare("SELECT name FROM shadowbot_migrations WHERE name=?")
        .bind(name)
        .first()
    )
      continue;
    const statements = readFileSync("drizzle/" + name, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    await db.batch([
      ...statements.map((s) => db.prepare(s)),
      db
        .prepare("INSERT INTO shadowbot_migrations VALUES (?,?)")
        .bind(name, Date.now()),
    ]);
    console.log("Applied " + name);
  }
  console.log("Local D1 is ready.");
} finally {
  await mf.dispose();
}
