#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true });
loadEnv({
  path: resolve(process.cwd(), ".env.local"),
  override: true,
  quiet: true,
});

const { scrapeFetch, scrapeFetchText } = await import("../lib/scrape/fetch.ts");
const { validateStreamUrlWithReferers } = await import(
  "../lib/scrape/validate-stream.ts"
);
const { wrapJustanimeMomoProxyUrl } = await import(
  "../lib/scrape/justanime-momo-proxy.ts"
);
const { normalizeAllanimeApiResponse } = await import(
  "../lib/scrape/anime/allanime-crypto.ts"
);

const mega =
  "https://9hjkrt.nekostream.site/f899139df5e1059396431415e770c6dd/61b87186ab260d05003427e16ccf5657/master.m3u8";

console.log("--- megaplay via momo ---");
const momo = wrapJustanimeMomoProxyUrl(mega);
console.log("momo url", momo.slice(0, 120));
const momoBody = await scrapeFetchText(momo, {
  Referer: "https://justanime.to/",
});
console.log(
  "momo status",
  momoBody.status,
  momoBody.text.slice(0, 200).replace(/\n/g, " | "),
);
console.log(
  "momo validate",
  (
    await validateStreamUrlWithReferers(momo, "https://justanime.to/", "hls", {
      depth: "full",
    })
  ).ok,
);
console.log(
  "direct mega validate",
  (
    await validateStreamUrlWithReferers(mega, "https://megaplay.buzz/", "hls", {
      depth: "full",
    })
  ).ok,
);

// child playlist probe
const child = new URL("index-f1-v1-a1.m3u8", mega).toString();
const childBody = await scrapeFetchText(child, {
  Referer: "https://megaplay.buzz/",
});
console.log(
  "child",
  childBody.status,
  childBody.text.slice(0, 250).replace(/\n/g, " | "),
);
const segMatch = childBody.text.match(/^(?!#)(\S+\.ts\S*)/m);
if (segMatch?.[1]) {
  const seg = new URL(segMatch[1], child).toString();
  try {
    const segRes = await scrapeFetch(seg, {
      method: "GET",
      headers: {
        Range: "bytes=0-1023",
        Referer: "https://megaplay.buzz/",
      },
      retryAttempts: 1,
    });
    const bytes = new Uint8Array(await segRes.arrayBuffer());
    console.log(
      "segment",
      segRes.status,
      "ct",
      segRes.headers.get("content-type"),
      "firstByte",
      bytes[0],
      "len",
      bytes.length,
    );
  } catch (error) {
    console.log(
      "segment error",
      error instanceof Error ? error.message : error,
    );
  }
}

console.log("\n--- allmanga.to frontend hashes ---");
const home = await scrapeFetchText("https://allmanga.to/", {
  Referer: "https://allmanga.to/",
});
console.log("home", home.status);
const scripts = [...home.text.matchAll(/src=["']([^"']+\.js[^"']*)["']/g)].map(
  (m) => m[1]!,
);
console.log("scripts", scripts.slice(0, 15));
const hashes = new Set<string>();
for (const src of scripts.slice(0, 12)) {
  const url = src.startsWith("http")
    ? src
    : `https://allmanga.to${src.startsWith("/") ? "" : "/"}${src}`;
  try {
    const js = await scrapeFetchText(url, { Referer: "https://allmanga.to/" });
    for (const match of js.text.matchAll(/[a-f0-9]{64}/g)) {
      // Keep hashes near episode-related keywords
      const idx = match.index ?? 0;
      const window = js.text.slice(Math.max(0, idx - 80), idx + 80);
      if (
        /persisted|Episode|sourceUrl|episodeString|sha256/i.test(window) ||
        js.text.includes("sourceUrls")
      ) {
        hashes.add(match[0]!);
      }
    }
    if (/sourceUrls|episodeString|persistedQuery/.test(js.text)) {
      console.log(
        "hit",
        url,
        "len",
        js.text.length,
        "sample",
        js.text.match(/persistedQuery.{0,120}/)?.[0],
      );
      const nearby = [
        ...js.text.matchAll(/sha256Hash["']?\s*[:=]\s*["']([a-f0-9]{64})["']/g),
      ].map((m) => m[1]!);
      nearby.forEach((h) => hashes.add(h));
      console.log("nearby hashes", nearby.slice(0, 10));
    }
  } catch (error) {
    console.log("js fail", url, error instanceof Error ? error.message : error);
  }
}
console.log("candidate hashes", [...hashes].slice(0, 20));

// Try ani-cli known hashes / alternate episode query
const showId = "ReooPAxPMsHM4KPMY";
const candidates = [
  "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec",
  ...hashes,
];

// Also try inline GraphQL episode query
const EPISODE_GQL = `query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
  episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) {
    episodeString sourceUrls { sourceUrl sourceName type priority }
  }
}`;

const inline = await scrapeFetch("https://api.allanime.day/api", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://allmanga.to",
    Referer: "https://allmanga.to/",
  },
  body: JSON.stringify({
    query: EPISODE_GQL,
    variables: {
      showId,
      translationType: "sub",
      episodeString: "1168",
    },
  }),
});
const inlineRaw = await inline.json();
const inlineNorm = normalizeAllanimeApiResponse(inlineRaw) as {
  data?: { episode?: { sourceUrls?: unknown[] } };
  errors?: unknown;
};
console.log(
  "inline episode",
  inline.status,
  "sources",
  inlineNorm.data?.episode?.sourceUrls?.length ?? 0,
  "errors",
  JSON.stringify(inlineNorm).includes("errors")
    ? JSON.stringify(inlineRaw).slice(0, 400)
    : "none",
  "keys",
  Object.keys(inlineRaw as object),
);

for (const hash of candidates.slice(0, 8)) {
  const variables = {
    showId,
    translationType: "sub",
    episodeString: "1168",
  };
  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: hash },
    }),
  });
  const r = await scrapeFetch(`https://api.allanime.day/api?${params}`, {
    headers: {
      Origin: "https://allmanga.to",
      Referer: "https://allmanga.to/",
    },
  });
  const raw = await r.json();
  const norm = normalizeAllanimeApiResponse(raw) as {
    data?: { episode?: { sourceUrls?: unknown[] } };
  };
  const n = norm.data?.episode?.sourceUrls?.length ?? 0;
  if (n > 0 || (raw as { errors?: unknown }).errors) {
    console.log(
      "hash",
      hash.slice(0, 12),
      "status",
      r.status,
      "sources",
      n,
      "raw",
      JSON.stringify(raw).slice(0, 200),
    );
  }
}

console.log("\n--- paradise playlist rewrite ---");
const streamLink =
  "B3BAxTwjRS2TlYN7JeJC7i80eQ4JFE6q8maEoF5r25HOO1f50K0GXY6dX6hnjC_JxeFAxHJAqW0k2i5VDqpuEHXGwIOkn6wPkfSOu05M5v-VUq5LMSCDOxtP30GqDhvtgJiNsxdsIld6EerWFQ";
const streamUrl = `https://stream.animeparadise.moe/m3u8?url=${encodeURIComponent(streamLink)}`;
const master = await scrapeFetchText(streamUrl, {
  Referer: "https://www.animeparadise.moe/",
});
console.log(master.text.slice(0, 500));
const variant = master.text
  .split("\n")
  .map((l) => l.trim())
  .find((l) => l.startsWith("/m3u8?url="));
if (variant) {
  const abs = `https://stream.animeparadise.moe${variant}`;
  const vb = await scrapeFetchText(abs, {
    Referer: "https://www.animeparadise.moe/",
  });
  console.log(
    "variant",
    vb.status,
    vb.text.slice(0, 300).replace(/\n/g, " | "),
  );
  const segLine = vb.text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"));
  if (segLine) {
    const segUrl = segLine.startsWith("http")
      ? segLine
      : segLine.startsWith("/")
        ? `https://stream.animeparadise.moe${segLine}`
        : new URL(segLine, abs).toString();
    try {
      const segRes = await scrapeFetch(segUrl, {
        method: "GET",
        headers: {
          Range: "bytes=0-1023",
          Referer: "https://www.animeparadise.moe/",
        },
        retryAttempts: 1,
      });
      const bytes = new Uint8Array(await segRes.arrayBuffer());
      console.log(
        "paradise seg",
        segRes.status,
        "ct",
        segRes.headers.get("content-type"),
        "first",
        bytes[0],
        "len",
        bytes.length,
      );
    } catch (error) {
      console.log(
        "paradise seg error",
        error instanceof Error ? error.message : error,
      );
    }
  }
  console.log(
    "abs variant validate",
    (
      await validateStreamUrlWithReferers(
        abs,
        "https://www.animeparadise.moe/",
        "hls",
        { depth: "full" },
      )
    ).ok,
  );
}
