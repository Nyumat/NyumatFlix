import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    "⚠️  DATABASE_URL is not set. Using dummy connection string for build.",
  );
}

const pool = postgres(
  connectionString || "postgres://postgres:postgres@localhost:5432/nyumatflix",
  { max: 1 },
);

export const db = drizzle(pool);
