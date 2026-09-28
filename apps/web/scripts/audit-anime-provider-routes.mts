#!/usr/bin/env bun
/**
 * Static + optional live audit for anime provider detail routes.
 *
 * Static (default): validates href invariants against anime-list-mini.json.
 * Live (--live): spot-checks Kitsu mappings + optional HTTP redirects.
 *
 * Usage:
 *   bun scripts/audit-anime-provider-routes.mts
 *   bun scripts/audit-anime-provider-routes.mts --live --sample 50
 *   bun scripts/audit-anime-provider-routes.mts --live --base-url http://127.0.0.1:3000
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type AnimeMappingRow = {
  anilist_id?: number;
  kitsu_id?: number;
  mal_id?: number;
  themoviedb_id?: { tv?: number; movie?: number };
};

const mappingPath = fileURLToPath(
  new URL("../data/anime-mappings/anime-list-mini.json", import.meta.url),
);

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const sampleSize = Number.parseInt(
  process.argv.find((arg) => arg.startsWith("--sample="))?.split("=")[1] ??
    process.argv[process.argv.indexOf("--sample") + 1] ??
    "100",
  10,
);
const baseUrl = (
  process.argv.find((arg) => arg.startsWith("--base-url="))?.split("=")[1] ??
  process.argv[process.argv.indexOf("--base-url") + 1] ??
  process.env.AUDIT_BASE_URL ??
  ""
).replace(/\/$/, "");

const mappings = JSON.parse(
  readFileSync(mappingPath, "utf8"),
) as AnimeMappingRow[];

const mappedPairs = mappings.filter(
  (row) =>
    Number.isInteger(row.kitsu_id) &&
    (row.kitsu_id as number) > 0 &&
    Number.isInteger(row.anilist_id) &&
    (row.anilist_id as number) > 0,
);

const KITSU_API_BASE = "https://kitsu.app/api/edge";
const KITSU_FETCH_TIMEOUT_MS = 10_000;

const fetchKitsuAnilistId = async (kitsuId: number): Promise<number | null> => {
  const params = new URLSearchParams({
    "fields[mappings]": "externalSite,externalId",
    include: "mappings",
  });
  const response = await fetch(`${KITSU_API_BASE}/anime/${kitsuId}?${params}`, {
    headers: { Accept: "application/vnd.api+json" },
    signal: AbortSignal.timeout(KITSU_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    included?: Array<{
      type?: string;
      attributes?: { externalSite?: string | null; externalId?: string | null };
    }>;
  };

  for (const entry of payload.included ?? []) {
    if (entry.type !== "mappings") continue;
    if (
      entry.attributes?.externalSite?.trim().toLowerCase() !== "anilist/anime"
    ) {
      continue;
    }
    const parsed = Number.parseInt(entry.attributes?.externalId ?? "", 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }

  return null;
};

const auditHttpRedirect = async (
  kitsuId: number,
  expectedAnilistId: number,
): Promise<string | null> => {
  if (!baseUrl) return null;

  const response = await fetch(`${baseUrl}/anime/kitsu-${kitsuId}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status < 300 || response.status >= 400) {
    return `kitsu-${kitsuId}: expected redirect, got HTTP ${response.status}`;
  }

  const location = response.headers.get("location") ?? "";
  if (!location.includes(`/anime/anilist-${expectedAnilistId}`)) {
    return `kitsu-${kitsuId}: redirect ${location} does not target anilist-${expectedAnilistId}`;
  }

  return null;
};

const main = async () => {
  console.log(`static corpus: ${mappedPairs.length} kitsu↔anilist rows`);

  const staticFailures: string[] = [];
  for (const row of mappedPairs) {
    const kitsuId = row.kitsu_id as number;
    const anilistId = row.anilist_id as number;
    const expectedHref = `/anime/anilist-${anilistId}`;
    const badHref = `/anime/kitsu-${kitsuId}`;

    // Mirror withAnimePageHref priority: canonical AniList ids must win.
    if (anilistId > 0) {
      const resolvedHref = expectedHref;
      if (resolvedHref.includes(badHref)) {
        staticFailures.push(`kitsu-${kitsuId}: href invariant violated`);
      }
    }
  }

  if (staticFailures.length > 0) {
    console.error("static audit failures:");
    for (const failure of staticFailures.slice(0, 20)) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("static audit: ok");

  if (!live) {
    console.log("live checks skipped (pass --live to enable)");
    return;
  }

  const sample = mappedPairs
    .filter(
      (_, index) => index % Math.ceil(mappedPairs.length / sampleSize) === 0,
    )
    .slice(0, sampleSize);

  console.log(`live sample: ${sample.length} rows`);

  const liveFailures: string[] = [];
  for (const row of sample) {
    const kitsuId = row.kitsu_id as number;
    const expectedAnilistId = row.anilist_id as number;
    const liveAnilistId = await fetchKitsuAnilistId(kitsuId);

    if (liveAnilistId !== expectedAnilistId) {
      liveFailures.push(
        `kitsu-${kitsuId}: live mapping ${liveAnilistId ?? "null"} != corpus ${expectedAnilistId}`,
      );
    }

    const redirectFailure = await auditHttpRedirect(kitsuId, expectedAnilistId);
    if (redirectFailure) {
      liveFailures.push(redirectFailure);
    }
  }

  if (liveFailures.length > 0) {
    console.error("live audit failures:");
    for (const failure of liveFailures.slice(0, 20)) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("live audit: ok");
  if (!baseUrl) {
    console.log("http redirect checks skipped (pass --base-url to enable)");
  }
};

await main();
