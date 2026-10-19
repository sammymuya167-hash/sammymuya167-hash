import { readFileSync, writeFileSync } from "node:fs";
const index = process.argv.indexOf("--database-id");
const databaseId = process.argv[index + 1];
if (
  index < 0 ||
  !databaseId ||
  !/^[a-f0-9-]{36}$/i.test(databaseId) ||
  databaseId === "00000000-0000-4000-8000-000000000000"
)
  throw new Error(
    "Pass --database-id with your actual Cloudflare D1 database UUID.",
  );
const path = "dist/server/wrangler.json";
const config = JSON.parse(readFileSync(path, "utf8"));
config.name = "shadowbot";
config.d1_databases = [
  {
    binding: "DB",
    database_name: "shadowbot",
    database_id: databaseId,
    migrations_dir: "../../drizzle",
  },
];
writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
console.log(
  "Prepared standalone deployment config. Apply migrations and configure provider secrets before deploying.",
);
