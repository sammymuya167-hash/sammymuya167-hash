import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Run the built production Worker against a disposable D1 database. Fixture
// identity headers emulate the trusted hosting gateway only inside this test.
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare } = require("miniflare");
const serverRoot = path.resolve("dist/server");
function moduleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? moduleFiles(path.join(directory, entry.name))
      : /\.m?js$/.test(entry.name)
        ? [path.join(directory, entry.name)]
        : [],
  );
}
const main = path.join(serverRoot, "index.js");
export const mf = new Miniflare({
  modules: [
    main,
    ...moduleFiles(serverRoot).filter((file) => file !== main),
  ].map((file) => ({ type: "ESModule", path: file })),
  modulesRoot: path.resolve("dist/server"),
  modulesRules: [{ type: "ESModule", include: ["**/*.js", "**/*.mjs"] }],
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  assets: {
    directory: path.resolve("dist/client"),
    binding: "ASSETS",
    routerConfig: {
      has_user_worker: true,
      invoke_user_worker_ahead_of_assets: true,
    },
  },
  port: 0,
});

export async function migrate() {
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql"))) {
    for (const sql of readFileSync(path.join("drizzle", file), "utf8").split(
      "--> statement-breakpoint",
    ))
      if (sql.trim()) await db.prepare(sql).run();
  }
}
export async function request(
  endpoint,
  method = "GET",
  body,
  owner = "test-a",
  origin = "https://app.test",
) {
  const headers = { Origin: origin };
  if (owner) {
    headers["oai-authenticated-user-id"] = owner;
    headers["oai-authenticated-user-email"] = owner + "@example.test";
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return mf.dispatchFetch("https://app.test" + endpoint, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
