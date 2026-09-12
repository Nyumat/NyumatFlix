import { scrapeFetchText } from "../lib/scrape/fetch.ts";
import {
  extractAllanimeBuildId,
  extractAllanimeMaskParts,
} from "../lib/scrape/anime/allanime-aareq.ts";

const home = await scrapeFetchText("https://mkissa.to/", {
  Referer: "https://mkissa.to/",
});
const appMatch = home.text.match(/_app\/immutable\/(entry\/app\.[^"'\\]+\.js)/);
console.log("entry", appMatch?.[1]);
const cdn = "https://cdn.allanime.day/all/mk/_app/immutable/";
const seen = new Set<string>();
const queue = appMatch?.[1] ? [appMatch[1]] : [];
let cryptoChunk: {
  rel: string;
  buildId: string | null;
  mask: string[] | null;
} | null = null;

while (queue.length > 0 && seen.size < 80) {
  const rel = queue.shift();
  if (!rel || seen.has(rel)) continue;
  seen.add(rel);
  const js = await scrapeFetchText(`${cdn}${rel}`, {
    Referer: "https://mkissa.to/",
  });
  if (js.status !== 200) continue;
  for (const match of js.text.matchAll(
    /(?:import|from)\s*["']\.\.?\/(?:chunks\/)?([A-Za-z0-9_-]+\.js)["']/g,
  )) {
    const next = `chunks/${match[1]}`;
    if (!seen.has(next)) queue.push(next);
  }
  for (const match of js.text.matchAll(
    /_app\/immutable\/chunks\/([A-Za-z0-9_-]+\.js)/g,
  )) {
    const next = `chunks/${match[1]}`;
    if (!seen.has(next)) queue.push(next);
  }
  if (!js.text.includes("client-crypto/v1/bootstrap")) continue;
  cryptoChunk = {
    rel,
    buildId: extractAllanimeBuildId(js.text),
    mask: extractAllanimeMaskParts(js.text),
  };
  break;
}

console.log("cryptoChunk", cryptoChunk);
console.log("visited", seen.size);
