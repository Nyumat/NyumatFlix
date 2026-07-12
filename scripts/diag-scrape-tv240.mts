import { scrapeVidNest } from "../lib/scrape/providers/vidnest";
import { scrapeVidrock } from "../lib/scrape/providers/vidrock";

const input = {
  mediaType: "tv" as const,
  tmdbId: 240,
  seasonNumber: 1,
  episodeNumber: 1,
};

console.log("--- VidNest ---");
const t0 = Date.now();
const vn = await scrapeVidNest(input);
console.log(
  JSON.stringify(
    {
      ok: vn.ok,
      error: vn.error,
      streamUrl: vn.streamUrl?.slice(0, 120),
      referer: vn.referer,
      qualities: vn.qualities?.length,
      ms: Date.now() - t0,
    },
    null,
    2,
  ),
);

console.log("--- VidRock ---");
const t1 = Date.now();
const vr = await scrapeVidrock(input);
console.log(
  JSON.stringify(
    {
      ok: vr.ok,
      error: vr.error,
      streamUrl: vr.streamUrl?.slice(0, 120),
      referer: vr.referer,
      ms: Date.now() - t1,
    },
    null,
    2,
  ),
);
