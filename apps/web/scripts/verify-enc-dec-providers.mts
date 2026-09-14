#!/usr/bin/env bun
/**
 * Live smoke for enabled in-house scrape (VidLink).
 * Hexa / AnimeKai scrape code remains in-repo but is omitted from provider races;
 * pass `--disabled` to probe those paths manually.
 *
 * Usage: cd apps/web && bun scripts/verify-enc-dec-providers.mts [--e2e] [--disabled]
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

import { encryptAnimeKai } from "../lib/scrape/anime/animekai-cipher-core.ts";
import { readBundledKaiDbEntry } from "../lib/scrape/anime/kai-db-bundled.ts";
import { decryptMegaupPayloadCore } from "../lib/scrape/megaup-cipher-core.ts";
import { encryptVidlinkMediaId } from "../lib/scrape/vidlink-cipher.ts";
import {
  encHexaCapToken,
  resetHexaWasmSessionForTests,
} from "../lib/scrape/hexa-wasm-session.ts";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const MEGAUP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type SmokeRow = { id: string; ok: boolean; ms: number; detail: string };

const movieInput = { mediaType: "movie" as const, tmdbId: 550 };
const includeDisabled = process.argv.includes("--disabled");

const runSmoke = async (
  id: string,
  fn: () => Promise<string>,
): Promise<SmokeRow> => {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { id, ok: true, ms: Date.now() - t0, detail };
  } catch (error) {
    return {
      id,
      ok: false,
      ms: Date.now() - t0,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
};

const scrapeProxyDispatcher = (): ProxyAgent | undefined => {
  const proxy = process.env.SCRAPE_PROXY_URL?.trim();
  if (!proxy) {
    return undefined;
  }
  return new ProxyAgent(proxy);
};

const proxiedFetch = async (
  url: string,
  init: RequestInit & { method?: string; headers?: Record<string, string> },
): Promise<Response> => {
  const dispatcher = scrapeProxyDispatcher();
  if (!dispatcher) {
    return fetch(url, init);
  }
  return undiciFetch(url, {
    ...init,
    dispatcher,
  }) as unknown as Response;
};

const findPlayableUrl = (value: unknown): string | null => {
  const walk = (node: unknown): string | null => {
    if (typeof node === "string") {
      const trimmed = node.trim();
      if (
        /^https?:\/\//i.test(trimmed) &&
        (/\.m3u8(?:[?#]|$)/i.test(trimmed) ||
          /\.mp4(?:[?#]|$)/i.test(trimmed) ||
          /\/media\//i.test(trimmed) ||
          /\/pl\//i.test(trimmed))
      ) {
        return trimmed;
      }
      return null;
    }
    if (Array.isArray(node)) {
      for (const entry of node) {
        const hit = walk(entry);
        if (hit) {
          return hit;
        }
      }
      return null;
    }
    if (node && typeof node === "object") {
      for (const key of ["url", "file", "link", "src"] as const) {
        const hit = walk((node as Record<string, unknown>)[key]);
        if (hit) {
          return hit;
        }
      }
      for (const entry of Object.values(node as Record<string, unknown>)) {
        const hit = walk(entry);
        if (hit) {
          return hit;
        }
      }
    }
    return null;
  };
  return walk(value);
};

const smokeVidlinkCipher = async (): Promise<string> => {
  const token = encryptVidlinkMediaId(movieInput.tmdbId);
  if (token.length < 40 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error("VidLink token shape invalid");
  }
  return `len=${token.length} prefix=${token.slice(0, 8)}…`;
};

const smokeVidlinkApi = async (): Promise<string> => {
  const token = encryptVidlinkMediaId(movieInput.tmdbId);
  const url = `https://vidlink.pro/api/b/movie/${token}?multiLang=1`;
  const response = await proxiedFetch(url, {
    headers: {
      Accept: "application/json",
      Origin: "https://vidlink.pro",
      Referer: "https://vidlink.pro/",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    throw new Error(`VidLink API HTTP ${response.status}`);
  }
  const text = await response.text();
  return `HTTP ${response.status} bytes=${text.length}`;
};

const smokeHexaEnc = async (): Promise<string> => {
  const token = await encHexaCapToken();
  if (!token) {
    throw new Error("hexa cap missing token");
  }
  return `token=${token.slice(0, 12)}… (disabled provider)`;
};

const smokeAnimekaiDb = async (): Promise<string> => {
  const entry = await readBundledKaiDbEntry(21);
  if (!entry) {
    throw new Error("bundled kai db missing anilist 21");
  }
  const encPlaintext =
    entry.info?.content_id?.trim() ||
    entry.episodes?.["1"]?.["1"]?.token?.trim() ||
    entry.info?.kai_id?.trim();
  if (!encPlaintext) {
    throw new Error("kai db missing enc-kai plaintext for anilist 21");
  }
  const encId = encryptAnimeKai(encPlaintext);
  return `plain=${encPlaintext.slice(0, 12)}… enc=${encId.slice(0, 10)}…`;
};

const e2eVidlinkMovie = async (): Promise<string> => {
  const token = encryptVidlinkMediaId(movieInput.tmdbId);
  const apiUrl = `https://vidlink.pro/api/b/movie/${token}?multiLang=1`;
  const api = await proxiedFetch(apiUrl, {
    headers: {
      Accept: "application/json",
      Origin: "https://vidlink.pro",
      Referer: "https://vidlink.pro/",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!api.ok) {
    throw new Error(`vidlink API HTTP ${api.status}`);
  }
  const payload: unknown = await api.json();
  const streamUrl = findPlayableUrl(payload);
  if (!streamUrl) {
    throw new Error("vidlink API missing playable URL");
  }
  return `stream=${streamUrl.slice(0, 72)}…`;
};

const e2eHexaMovie550 = async (): Promise<string> => {
  const { scrapeProvider } = await import("../lib/scrape/index.ts");
  const result = await scrapeProvider("hexa", {
    mediaType: "movie",
    tmdbId: 550,
  });
  if (!result.ok) {
    throw new Error(result.error ?? "hexa scrape failed");
  }
  return `stream=${result.streamUrl.slice(0, 72)}…`;
};

const e2eAnimekaiMegaup = async (): Promise<string> => {
  const entry = await readBundledKaiDbEntry(21);
  if (!entry) {
    throw new Error("bundled kai db missing anilist 21");
  }
  const mirrors = entry.info?.mirrors?.megaup ?? [];
  const mediaPath = entry.episodes?.["1"]?.["1"]?.sources?.softsub?.server1;
  if (!mediaPath) {
    throw new Error("kai db missing megaup path for ep1");
  }

  let lastError = "megaup unavailable";
  for (const mirrorRaw of mirrors) {
    const mirror = mirrorRaw.replace(/\/$/, "");
    const mediaUrl = `${mirror}/${mediaPath.replace(/^\//, "")}`;
    const referer = `${mirror}/`;
    try {
      let mediaResponse = await proxiedFetch(mediaUrl, {
        headers: {
          Accept: "application/json",
          Referer: referer,
          "User-Agent": MEGAUP_USER_AGENT,
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!mediaResponse.ok && mediaResponse.status >= 500) {
        mediaResponse = await fetch(mediaUrl, {
          headers: {
            Accept: "application/json",
            Referer: referer,
            "User-Agent": MEGAUP_USER_AGENT,
          },
          signal: AbortSignal.timeout(12_000),
        });
      }
      if (!mediaResponse.ok) {
        lastError = `megaup media HTTP ${mediaResponse.status} (${mirror})`;
        continue;
      }
      const envelope = (await mediaResponse.json()) as { result?: string };
      if (!envelope.result) {
        lastError = `megaup missing result (${mirror})`;
        continue;
      }
      const decrypted = decryptMegaupPayloadCore(envelope.result, {
        userAgent: MEGAUP_USER_AGENT,
        mediaId: mediaPath.split("/").pop(),
      });
      const streamUrl = findPlayableUrl(decrypted);
      if (!streamUrl) {
        lastError = `megaup decrypt missing URL (${mirror})`;
        continue;
      }
      return `mirror=${new URL(mirror).hostname} ${streamUrl.slice(0, 60)}…`;
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : `megaup failed (${mirror})`;
    }
  }

  throw new Error(lastError);
};

const main = async () => {
  console.log("in-house scrape smoke (VidLink enabled)");
  console.log(
    `SCRAPE_PROXY_URL=${process.env.SCRAPE_PROXY_URL ?? "(unset)"}\n`,
  );

  const rows: SmokeRow[] = [];
  rows.push(await runSmoke("vidlink-cipher", smokeVidlinkCipher));
  rows.push(await runSmoke("vidlink-api", smokeVidlinkApi));

  if (includeDisabled) {
    rows.push(await runSmoke("hexa-enc (disabled)", smokeHexaEnc));
    rows.push(await runSmoke("animekai-db (disabled)", smokeAnimekaiDb));
  }

  for (const row of rows) {
    console.log(
      `${row.ok ? "OK" : "FAIL"} ${row.id.padEnd(26)} ${String(row.ms).padStart(6)}ms  ${row.detail}`,
    );
  }

  const ok = rows.filter((r) => r.ok).length;
  console.log(`\nSummary: ${ok}/${rows.length}`);

  if (process.argv.includes("--e2e")) {
    console.log("\n=== E2E scrape probes ===\n");
    const e2eRows: SmokeRow[] = [];
    e2eRows.push(await runSmoke("e2e-vidlink", e2eVidlinkMovie));
    if (includeDisabled) {
      e2eRows.push(await runSmoke("e2e-hexa (disabled)", e2eHexaMovie550));
      e2eRows.push(
        await runSmoke("e2e-animekai (disabled)", e2eAnimekaiMegaup),
      );
    }
    for (const row of e2eRows) {
      console.log(
        `${row.ok ? "OK" : "FAIL"} ${row.id.padEnd(26)} ${String(row.ms).padStart(6)}ms  ${row.detail}`,
      );
    }
    const e2eOk = e2eRows.filter((r) => r.ok).length;
    console.log(`\nE2E summary: ${e2eOk}/${e2eRows.length}`);
    if (e2eOk < e2eRows.length) {
      process.exitCode = 1;
    }
  }

  if (ok < rows.length) {
    process.exitCode = 1;
  }

  await resetHexaWasmSessionForTests().catch(() => undefined);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
