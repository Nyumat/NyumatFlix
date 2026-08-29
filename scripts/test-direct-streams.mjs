#!/usr/bin/env node
/**
 * Local Direct stream verification — run before deploy.
 * Usage: node scripts/test-direct-streams.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:3000
 */
const BASE = process.argv[2] ?? "http://127.0.0.1:3000";

const TITLES = [
  ["Shrek", 808],
  ["Gone Girl", 210577],
  ["Dark Knight", 155],
  ["Matrix", 603],
  ["Inception", 27205],
  ["Shrek 2", 809],
];

function magicKind(bytes) {
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74) return "mp4";
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45) return "mkv";
  if (
    bytes.length >= 7 &&
    new TextDecoder().decode(bytes.slice(0, 7)) === "#EXTM3U"
  )
    return "hls";
  return "other";
}

async function scrape(tmdbId) {
  const res = await fetch(`${BASE}/api/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerId: "direct",
      tmdbId,
      mediaType: "movie",
    }),
  });
  return res.json();
}

async function probe(playUrl) {
  const url = playUrl.startsWith("http") ? playUrl : `${BASE}${playUrl}`;
  const head = await fetch(url, { method: "HEAD" });
  const get = await fetch(url, { headers: { Range: "bytes=0-8191" } });
  const bytes = new Uint8Array(await get.arrayBuffer());
  return {
    headStatus: head.status,
    headType: head.headers.get("content-type"),
    getStatus: get.status,
    getType: get.headers.get("content-type"),
    magic: magicKind(bytes),
  };
}

async function probeHlsInit(fallbackUrl) {
  if (!fallbackUrl) return null;
  const url = fallbackUrl.startsWith("http")
    ? fallbackUrl
    : `${BASE}${fallbackUrl}`;
  const text = await (await fetch(url)).text();
  const initMatch = text.match(/URI="([^"]+)"/) ?? text.match(/URI=([^,\n]+)/);
  if (!initMatch) return { error: "no init in playlist" };
  const initPath = initMatch[1];
  const initUrl = initPath.startsWith("http") ? initPath : `${BASE}${initPath}`;
  const res = await fetch(initUrl, { headers: { Range: "bytes=0-15" } });
  return {
    initPath,
    status: res.status,
    sameOrigin: initPath.startsWith("/api/direct/"),
  };
}

let failed = 0;
console.log(`Testing Direct streams at ${BASE}\n`);

for (const [name, tmdbId] of TITLES) {
  const result = await scrape(tmdbId);
  if (!result.ok) {
    console.log(`FAIL ${name} (${tmdbId}): scrape — ${result.error}`);
    failed++;
    continue;
  }

  const p = await probe(result.playUrl);
  const hls = await probeHlsInit(result.directFallbackUrl);
  const engine =
    result.directPlayback === "extended"
      ? "movi (expected)"
      : result.directPlayback === "direct"
        ? "vidstack-direct → movi fallback"
        : result.directPlayback;

  const ok =
    result.directPlayback === "extended"
      ? p.magic === "mkv" || p.magic === "mp4"
      : p.magic === "mp4";

  if (!ok) failed++;

  console.log(`${ok ? "OK  " : "BAD "} ${name} (${tmdbId})`);
  console.log(`      playback=${result.directPlayback} engine=${engine}`);
  console.log(
    `      probe head=${p.headStatus} ${p.headType} magic=${p.magic} get=${p.getStatus}`,
  );
  console.log(
    `      fallback=${result.directFallbackUrl ? "yes" : "no"}${
      hls ? ` init=${hls.status} sameOrigin=${hls.sameOrigin}` : ""
    }`,
  );
}

console.log(
  `\n${failed ? "FAILED" : "PASSED"} (${TITLES.length - failed}/${TITLES.length} ok)`,
);
process.exit(failed ? 1 : 0);
