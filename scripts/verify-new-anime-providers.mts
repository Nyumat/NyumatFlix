#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const { scrapeAnimeProvider } = await import("../lib/scrape/anime/index.ts");

const providers = [
  "justanime",
  "anikitty",
  "animeparadise",
  "kyren",
  "anikuro",
] as const;

for (const providerId of providers) {
  const started = Date.now();
  const result = await scrapeAnimeProvider(providerId, {
    anilistId: 21,
    episodeNumber: 1,
    translationType: "sub",
  });
  console.log(
    JSON.stringify(
      {
        providerId,
        ms: Date.now() - started,
        ok: result.ok,
        ...(result.ok
          ? {
              streamUrl: result.streamUrl.slice(0, 140),
              referer: result.referer,
              qualities: result.qualities?.length ?? 0,
            }
          : { error: result.error }),
      },
      null,
      2,
    ),
  );
}
