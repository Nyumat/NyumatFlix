#!/usr/bin/env bun
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

import { scrapeProvider } from "../lib/scrape/index.ts";

const main = async () => {
  const started = Date.now();
  const result = await scrapeProvider("hexa", {
    mediaType: "movie",
    tmdbId: 550,
  });
  const elapsed = Date.now() - started;

  if (!result.ok) {
    console.error(`hexa scrape failed (${elapsed}ms): ${result.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`hexa ok (${elapsed}ms)`);
  console.log(result.streamUrl);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
