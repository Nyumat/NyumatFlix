import { config } from "dotenv";
import { resolve } from "path";
import postgres from "postgres";

if (!process.env.DATABASE_URL && !process.env.PROD_DATABASE_URL) {
  config({ path: resolve(process.cwd(), ".env.local") });
}

const connectionString =
  process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL (or PROD_DATABASE_URL) is not set");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

const VALID_STATUSES = [
  "watching",
  "plan_to_watch",
  "on_hold",
  "dropped",
  "completed",
];

try {
  const invalidRows = await sql`
    SELECT status, COUNT(*)::int AS count
    FROM watchlist
    WHERE status NOT IN ${sql(VALID_STATUSES)}
    GROUP BY status
    ORDER BY count DESC
  `;

  if (invalidRows.length > 0) {
    console.log("Invalid watchlist statuses found:");
    for (const row of invalidRows) {
      console.log(`  ${row.status}: ${row.count}`);
    }
  } else {
    console.log("No invalid watchlist statuses found.");
  }

  const waiting = await sql`
    UPDATE watchlist
    SET status = 'plan_to_watch'
    WHERE status = 'waiting'
  `;
  const finished = await sql`
    UPDATE watchlist
    SET status = 'completed'
    WHERE status = 'finished'
  `;
  const fallback = await sql`
    UPDATE watchlist
    SET status = 'watching'
    WHERE status NOT IN ${sql(VALID_STATUSES)}
  `;

  console.log(
    `Repaired rows — waiting→plan_to_watch: ${waiting.count}, finished→completed: ${finished.count}, other→watching: ${fallback.count}`,
  );

  const remaining = await sql`
    SELECT COUNT(*)::int AS count
    FROM watchlist
    WHERE status NOT IN ${sql(VALID_STATUSES)}
  `;

  if (remaining[0]?.count > 0) {
    console.error(
      `Still ${remaining[0].count} invalid rows after repair. Inspect manually.`,
    );
    process.exit(1);
  }

  console.log("Watchlist status repair complete.");
} finally {
  await sql.end();
}
