import { scrapeFetchText } from "../lib/scrape/fetch.ts";
import {
  buildAllanimeAaReq,
  extractAllanimeBuildId,
  extractAllanimeMaskParts,
  invalidateAllanimeAaReqCache,
} from "../lib/scrape/anime/allanime-aareq.ts";
import { scrapeAllmanga } from "../lib/scrape/anime/providers/allmanga.ts";

const chunk = await scrapeFetchText(
  "https://cdn.allanime.day/all/mk/_app/immutable/chunks/6_SNhjnz.js",
  { Referer: "https://mkissa.to/" },
);
console.log("chunk status", chunk.status, "len", chunk.text.length);
console.log("buildId", extractAllanimeBuildId(chunk.text));
console.log("mask", extractAllanimeMaskParts(chunk.text));

invalidateAllanimeAaReqCache();
try {
  const req = await buildAllanimeAaReq();
  console.log("aaReq", req.buildId, req.lane);
} catch (error) {
  console.log("aaReq error", error instanceof Error ? error.message : error);
}

const result = await scrapeAllmanga({
  anilistId: 21,
  episodeNumber: 1,
  translationType: "sub",
});
console.log(
  "allmanga",
  result.ok,
  result.ok ? result.streamUrl.slice(0, 80) : result.error,
);
