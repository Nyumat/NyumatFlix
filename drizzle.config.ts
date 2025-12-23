import type { Config } from "drizzle-kit";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") });

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.NODE_ENV === "production"
        ? process.env.PROD_DATABASE_URL!
        : process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
} satisfies Config;
