import { scrapeFetchText } from "../lib/scrape/fetch";
import { decodeVidnestPayload } from "../lib/scrape/vidnest-crypto";
import { extractVidnestStreams } from "../lib/scrape/vidnest-shared";
import { validateStreamUrlWithReferers } from "../lib/scrape/validate-stream";

async function probe(path: string, resolver: string) {
  const url = `https://new.vidnest.fun/${resolver}/${path}`;
  const res = await scrapeFetchText(url, {
    Accept: "application/json",
    Referer: "https://vidnest.fun/",
  });
  if (res.status !== 200) {
    return { resolver, status: res.status, streams: 0 };
  }

  try {
    const envelope = JSON.parse(res.text) as { data?: string };
    if (!envelope.data) {
      return { resolver, status: res.status, streams: 0, note: "no data" };
    }
    const payload = JSON.parse(decodeVidnestPayload(envelope.data));
    const streams = extractVidnestStreams(payload);
    return {
      resolver,
      status: res.status,
      streams: streams.length,
      sample: streams[0]?.url?.slice(0, 100),
      type: streams[0]?.type,
    };
  } catch (error) {
    return {
      resolver,
      status: res.status,
      err: error instanceof Error ? error.message : String(error),
    };
  }
}

async function validateSample(url: string) {
  const kind = /\.mp4/i.test(url) ? "mp4" : "hls";
  const referers = ["https://vidnest.fun/", "", new URL(url).origin + "/"];
  for (const referer of referers) {
    const master = await validateStreamUrlWithReferers(url, referer, kind, {
      depth: "master",
    });
    const full = await validateStreamUrlWithReferers(url, referer, kind, {
      depth: "full",
    });
    console.log(
      "  referer",
      referer || "(empty)",
      "master",
      master.ok,
      "full",
      full.ok,
    );
  }
}

const paths = ["tv/240/1/1", "tv/94605/1/1"];
const resolvers = [
  "ophim",
  "klikxxi",
  "movies5f",
  "hollymoviehd",
  "videasy",
  "moviesapi",
  "allmovies",
  "moviebox",
  "vidlink",
  "flixhq",
  "showbox",
  "embedsu",
  "vidsrc",
  "2embed",
];

for (const path of paths) {
  console.log(`\nPATH ${path}`);
  for (const resolver of resolvers) {
    const result = await probe(path, resolver);
    console.log(result);
    if (result.sample) {
      await validateSample(result.sample);
    }
  }
}
