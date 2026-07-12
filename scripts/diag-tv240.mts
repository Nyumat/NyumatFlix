import { scrapeFetchText } from "../lib/scrape/fetch";
import { decodeVidnestPayload } from "../lib/scrape/vidnest-crypto";
import { extractVidnestStreams } from "../lib/scrape/vidnest-shared";
import { decryptVidrockUrl } from "../lib/scrape/providers/vidrock";
import { validateStreamUrlWithReferers } from "../lib/scrape/validate-stream";

const mediaPath = "tv/240/1/1";

const resolvers = [
  "ophim",
  "moviesapi",
  "vidsrc",
  "2embed",
  "flixhq",
  "embedsu",
  "multiembed",
] as const;

for (const resolver of resolvers) {
  try {
    const res = await scrapeFetchText(
      `https://new.vidnest.fun/${resolver}/${mediaPath}`,
      { Accept: "application/json", Referer: "https://vidnest.fun/" },
    );
    if (res.status !== 200) {
      console.log(resolver, "status", res.status);
      continue;
    }
    const envelope = JSON.parse(res.text) as { data?: string };
    if (!envelope.data) {
      console.log(resolver, "no data");
      continue;
    }
    const payload = JSON.parse(decodeVidnestPayload(envelope.data));
    const streams = extractVidnestStreams(payload);
    console.log(
      resolver,
      "streams",
      streams.length,
      streams.slice(0, 2).map((s) => s.url?.slice(0, 90)),
    );
  } catch (error) {
    console.log(
      resolver,
      "err",
      error instanceof Error ? error.message : String(error),
    );
  }
}

const api = await scrapeFetchText("https://vidrock.net/api/tv/240/1/1", {
  Accept: "application/json",
  Referer: "https://vidrock.net/",
  Origin: "https://vidrock.net",
});
console.log("vidrock status", api.status, "len", api.text.length);
const payload = JSON.parse(api.text) as Record<
  string,
  { url?: string; type?: string } | null | undefined
>;
let count = 0;
for (const [name, entry] of Object.entries(payload)) {
  if (!entry?.url) continue;
  try {
    const url = decryptVidrockUrl(entry.url);
    count += 1;
    if (count <= 5) {
      const kind = /\.mp4/i.test(url) ? "mp4" : "hls";
      const master = await validateStreamUrlWithReferers(
        url,
        "https://vidrock.net/",
        kind,
        { depth: "master" },
      );
      const full = await validateStreamUrlWithReferers(
        url,
        "https://vidrock.net/",
        kind,
        { depth: "full" },
      );
      console.log(
        name,
        kind,
        url.slice(0, 100),
        "master",
        master.ok,
        "full",
        full.ok,
      );
    }
  } catch {
    console.log(name, "decrypt err");
  }
}
