import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

const webRoot = resolve(import.meta.dirname, "..");
const migrationsDir = resolve(webRoot, "db/migrations");

if (!process.env.DATABASE_URL && !process.env.PROD_DATABASE_URL) {
  config({ path: resolve(webRoot, ".env.local") });
}

const connectionString =
  process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL (or PROD_DATABASE_URL) is not set");
  process.exit(1);
}

const journalPath = resolve(migrationsDir, "meta/_journal.json");
if (!existsSync(journalPath)) {
  console.error("migration journal missing:", journalPath);
  process.exit(1);
}

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const migrations = journal.entries.map((entry) => {
  const sqlPath = resolve(migrationsDir, `${entry.tag}.sql`);
  const query = readFileSync(sqlPath, "utf8");
  return {
    tag: entry.tag,
    when: entry.when,
    hash: createHash("sha256").update(query).digest("hex"),
  };
});

const sql = postgres(connectionString, { max: 1, ssl: "require" });

try {
  const schemaExists = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user'
    ) AS exists
  `;

  if (!schemaExists[0]?.exists) {
    console.log(
      "public schema not initialized — drizzle migrate will apply baseline.",
    );
    process.exit(0);
  }

  await sql.unsafe('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const applied = await sql`
    SELECT id, hash, created_at
    FROM "drizzle"."__drizzle_migrations"
    ORDER BY created_at DESC
  `;

  const expectedHashes = new Set(migrations.map((migration) => migration.hash));
  const hasValidJournal =
    applied.length > 0 &&
    applied.every(
      (row) =>
        typeof row.hash === "string" &&
        /^[a-f0-9]{64}$/.test(row.hash) &&
        expectedHashes.has(row.hash),
    );

  if (hasValidJournal) {
    console.log("migration journal already stamped.");
    process.exit(0);
  }

  if (applied.length > 0) {
    console.log("repairing invalid migration journal entries...");
    await sql`DELETE FROM "drizzle"."__drizzle_migrations"`;
  }

  for (const migration of migrations) {
    await sql`
      INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
      VALUES (${migration.hash}, ${migration.when})
    `;
    console.log(`stamped ${migration.tag} (${migration.hash.slice(0, 12)}…)`);
  }

  console.log("baseline migration journal stamped for existing database.");
} finally {
  await sql.end();
}
