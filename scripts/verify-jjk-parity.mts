#!/usr/bin/env node
/**
 * JJK parity probe — print stream + subs/qualities/audio for each provider.
 * Usage: bun x tsx scripts/verify-jjk-parity.mts
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import type { AnimeScrapeProviderId } from "../lib/scrape/anime/types.ts";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const { scrapeAnimeProvider } = await import("../lib/scrape/anime/index.ts");

const PROVIDERS: AnimeScrapeProviderId[] = [
  "anizone",
  "kickassanime",
  "animeonsen",
  "allmanga",
  "animestream",
  "animegg",
  "animepahe",
];

const JJK = {
  anilistId: 113415,
  episodeNumber: 1,
  query: "Jujutsu Kaisen",
};

const main = async () => {
  console.log("JJK ep1 parity probe");
  console.log(
    `SCRAPE_PROXY_URL=${process.env.SCRAPE_PROXY_URL ?? "(unset)"}\n`,
  );

  for (const translationType of ["sub", "dub"] as const) {
    console.log(`=== ${translationType.toUpperCase()} ===`);
    for (const providerId of PROVIDERS) {
      const started = Date.now();
      const result = await scrapeAnimeProvider(providerId, {
        ...JJK,
        translationType,
      });
      const elapsed = Date.now() - started;

      if (!result.ok) {
        console.log(`✗ ${providerId} (${elapsed}ms) ${result.error}`);
        continue;
      }

      console.log(
        `✓ ${providerId} (${elapsed}ms) ${result.streamKind}` +
          ` audio=${result.defaultAudioLang ?? result.preferredAudioLang ?? "-"}` +
          ` hard=${result.defaultHardSubLang ?? "-"}` +
          ` subs=${result.subtitles?.length ?? 0}` +
          ` qualities=${result.qualities?.length ?? 0}` +
          ` versions=${result.audioVersions?.length ?? 0}`,
      );
      if (result.audioVersions?.length) {
        console.log(
          `    audio: ${result.audioVersions
            .map(
              (v) =>
                `${v.lang}${v.hardSubs?.length ? `+${v.hardSubs.length}hard` : ""}`,
            )
            .join(" | ")}`,
        );
      }
      if (result.subtitles?.length) {
        console.log(
          `    subs: ${result.subtitles.map((t) => t.lang).join(" | ")}`,
        );
      }
      if (result.qualities?.length) {
        console.log(
          `    qualities: ${result.qualities.map((q) => q.label).join(", ")}`,
        );
      }
    }
    console.log("");
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
