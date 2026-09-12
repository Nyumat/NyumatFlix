import { config } from "dotenv";
import type { Config } from "drizzle-kit";
import { resolve } from "path";

if (!process.env.DATABASE_URL && !process.env.PROD_DATABASE_URL) {
  config({ path: resolve(process.cwd(), ".env.local") });
}

const databaseUrl = process.env.DATABASE_URL ?? process.env.PROD_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or PROD_DATABASE_URL must be set for drizzle-kit",
  );
}

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
} satisfies Config;
