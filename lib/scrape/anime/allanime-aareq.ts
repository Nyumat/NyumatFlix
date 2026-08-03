/**
 * AllAnime episode-source aaReq token (AES-GCM).
 *
 * Upstream returns AA_CRYPTO_MISSING without extensions.aaReq. Crypto rotates via
 * api.mkissa.net/client-crypto bootstrap + mask embedded in the mkissa chunk.
 *
 * Protocol (2026-07): payload includes buildId; IV = sha256(epoch:buildId:qh:ts)[:12].
 */
import { createCipheriv, createDecipheriv, createHash } from "node:crypto";

import { cancelResponseBody, scrapeFetch, scrapeFetchText } from "../fetch";

const MKISSA_URL = "https://mkissa.to/";
const CDN_IMMUTABLE = "https://cdn.allanime.day/all/mk/_app/immutable/";
const BOOTSTRAP_ORIGIN = "https://api.mkissa.net";
const ALLANIME_API_HOSTS = [
  "https://api.mkissa.net/api",
  "https://api.allanime.day/api",
] as const;

const FALLBACK_BUILD_ID = "65";
const FALLBACK_EPOCH = 6886;
const FALLBACK_MASK =
  "4c0fd194e7db4e49ccce2f6f7f52afb5e6894c05b92b7550760b2c8e68c550ee";
const FALLBACK_PART_B = "6VMyyWQaDzYTIi79veroW0jRmb4KGtQppJiGSmTGB3s=";
export const ALLANIME_EPISODE_QUERY_HASH_FALLBACK =
  "f4662f4b7510b26795dd53ef824a0bf1740fbbc5d1273fab18222ac831bca8d0";

const RESPONSE_STATIC_KEY = createHash("sha256")
  .update("Xot36i3lK3:v1")
  .digest();

const WINDOW_MS = 300_000;

type CachedCrypto = {
  expiresMs: number;
  epoch: number;
  buildId: string;
  key: Buffer;
  queryHash: string;
};

let cache: CachedCrypto | null = null;

export const deriveAllanimeAaReqKey = (
  maskHex: string,
  partBBase64: string,
): Buffer => {
  const partA = Buffer.from(maskHex, "hex");
  const partB = Buffer.from(partBBase64, "base64");
  const key = Buffer.alloc(32);
  for (let index = 0; index < 32; index += 1) {
    key[index] = (partA[index] ?? 0) ^ (partB[index] ?? 0);
  }
  return key;
};

const identifierBoundary = (name: string): string => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // `\b` breaks on `$`-prefixed names like `$r` — use a negative lookbehind.
  return `(?<![\\w$])${escaped}`;
};

/** Assemble template-literal GraphQL docs the way the AllAnime chunk does. */
export const resolveAllanimeSourceQueryHash = (
  chunkJs: string,
): string | null => {
  const templates = [...chunkJs.matchAll(/`([^`]*)`/g)].map(
    (match) => match[1] ?? "",
  );
  const template = templates.find(
    (entry) => entry.includes("sourceUrls") && entry.includes("episode("),
  );
  if (!template) {
    return null;
  }

  const resolve = (tmpl: string, depth = 0): string => {
    if (depth > 8) {
      return tmpl;
    }

    return tmpl.replace(/\$\{([^}]+)\}/g, (_full, rawName: string) => {
      const name = rawName.trim();
      if (name.endsWith("()")) {
        const fnName = name.slice(0, -2);
        // Prefer the false branch of `x => x ? \`a\` : \`b\`` (matches live hash).
        const fn = chunkJs.match(
          new RegExp(
            `${identifierBoundary(fnName)}\\s*=\\s*\\(?\\w+\\)?\\s*=>\\s*\\(?\\w+\\)?\\s*\\?\\s*\`[^\`]*\`\\s*:\\s*\`([^\`]*)\``,
          ),
        );
        if (fn?.[1]) {
          return resolve(fn[1], depth + 1);
        }
        const nilary = chunkJs.match(
          new RegExp(
            `${identifierBoundary(fnName)}\\s*=\\s*\\(\\)\\s*=>\\s*\`([^\`]*)\``,
          ),
        );
        return nilary?.[1] ? resolve(nilary[1], depth + 1) : "";
      }

      const variable = chunkJs.match(
        new RegExp(`${identifierBoundary(name)}\\s*=\\s*\`([^\`]*)\``),
      );
      return variable?.[1] ? resolve(variable[1], depth + 1) : "";
    });
  };

  const query = resolve(template);
  if (query.includes("${")) {
    return null;
  }

  return createHash("sha256").update(query).digest("hex");
};

const extractBuildId = (chunkJs: string): string | null => {
  const match = chunkJs.match(
    /gr\s*=\s*[^?]*\?\s*["'](\d{1,8})["']\s*:\s*["']["']/,
  );
  return match?.[1] ?? null;
};

const extractMask = (chunkJs: string): string | null => {
  const masks = [...chunkJs.matchAll(/[0-9a-f]{64}/g)].map(
    (match) => match[0]!,
  );
  if (masks.length === 1 && masks[0]) {
    return masks[0];
  }
  const embedded = chunkJs.match(/["']([0-9a-f]{64})["']\s*:\s*["']["']/);
  return embedded?.[1] ?? masks[0] ?? null;
};

type BootstrapPayload = {
  partB: string;
  epoch: number;
  switchAt: number;
  graceMs: number;
};

const fetchBootstrap = async (
  buildId: string,
): Promise<BootstrapPayload | null> => {
  try {
    const response = await scrapeFetch(
      `${BOOTSTRAP_ORIGIN}/client-crypto/v1/bootstrap?buildId=${encodeURIComponent(buildId)}`,
      {
        headers: {
          Accept: "application/json",
          "x-build-id": buildId,
          Origin: "https://mkissa.to",
          Referer: MKISSA_URL,
        },
        timeoutMs: 12_000,
        retryAttempts: 1,
      },
    );
    if (!response.ok) {
      await cancelResponseBody(response);
      return null;
    }
    const payload = (await response.json()) as {
      partB?: string;
      epoch?: number;
      switchAt?: number;
      graceMs?: number;
    };
    if (!payload.partB || payload.epoch == null) {
      return null;
    }
    return {
      partB: payload.partB,
      epoch: payload.epoch,
      switchAt: payload.switchAt ?? 0,
      graceMs: payload.graceMs ?? 0,
    };
  } catch {
    return null;
  }
};

const discoverChunkCrypto = async (): Promise<{
  buildId: string;
  mask: string;
  queryHash: string;
} | null> => {
  try {
    const home = await scrapeFetchText(MKISSA_URL, {
      Referer: MKISSA_URL,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    });
    if (home.status !== 200) {
      return null;
    }

    const appMatch = home.text.match(
      /_app\/immutable\/(entry\/app\.[^"'\\]+\.js)/,
    );
    if (!appMatch?.[1]) {
      return null;
    }

    const seen = new Set<string>();
    const queue = [appMatch[1]];
    while (queue.length > 0 && seen.size < 80) {
      const relative = queue.shift();
      if (!relative || seen.has(relative)) {
        continue;
      }
      seen.add(relative);

      const js = await scrapeFetchText(`${CDN_IMMUTABLE}${relative}`, {
        Referer: MKISSA_URL,
      });
      if (js.status !== 200) {
        continue;
      }

      for (const match of js.text.matchAll(
        /(?:import|from)\s*["']\.\.?\/(?:chunks\/)?([A-Za-z0-9_-]+\.js)["']/g,
      )) {
        const next = `chunks/${match[1]}`;
        if (!seen.has(next)) {
          queue.push(next);
        }
      }
      for (const match of js.text.matchAll(
        /_app\/immutable\/chunks\/([A-Za-z0-9_-]+\.js)/g,
      )) {
        const next = `chunks/${match[1]}`;
        if (!seen.has(next)) {
          queue.push(next);
        }
      }

      const looksLikeCrypto =
        js.text.includes("__aaCrypto") ||
        js.text.includes("client-crypto/v1/bootstrap") ||
        (js.text.includes("sourceUrls") &&
          [...js.text.matchAll(/[0-9a-f]{64}/g)].length >= 1);
      if (!looksLikeCrypto) {
        continue;
      }

      const mask = extractMask(js.text);
      const buildId = extractBuildId(js.text) ?? FALLBACK_BUILD_ID;
      const queryHash =
        resolveAllanimeSourceQueryHash(js.text) ??
        ALLANIME_EPISODE_QUERY_HASH_FALLBACK;
      if (!mask) {
        continue;
      }

      return { buildId, mask, queryHash };
    }

    return null;
  } catch {
    return null;
  }
};

const fetchLiveCrypto = async (): Promise<CachedCrypto | null> => {
  const discovered = await discoverChunkCrypto();
  const buildId = discovered?.buildId ?? FALLBACK_BUILD_ID;
  const mask = discovered?.mask ?? FALLBACK_MASK;
  const queryHash =
    discovered?.queryHash ?? ALLANIME_EPISODE_QUERY_HASH_FALLBACK;

  const bootstrap = await fetchBootstrap(buildId);
  if (!bootstrap) {
    return null;
  }

  const expiresMs = Math.max(
    bootstrap.switchAt + bootstrap.graceMs,
    Date.now() + 3_600_000,
  );

  return {
    expiresMs,
    epoch: bootstrap.epoch,
    buildId,
    key: deriveAllanimeAaReqKey(mask, bootstrap.partB),
    queryHash,
  };
};

const getCrypto = async (): Promise<CachedCrypto> => {
  if (cache && cache.expiresMs > Date.now()) {
    return cache;
  }

  const live = await fetchLiveCrypto();
  if (live) {
    cache = live;
    return live;
  }

  return {
    expiresMs: Date.now() + 60_000,
    epoch: FALLBACK_EPOCH,
    buildId: FALLBACK_BUILD_ID,
    key: deriveAllanimeAaReqKey(FALLBACK_MASK, FALLBACK_PART_B),
    queryHash: ALLANIME_EPISODE_QUERY_HASH_FALLBACK,
  };
};

export const invalidateAllanimeAaReqCache = (): void => {
  cache = null;
};

export const buildAllanimeAaReq = async (): Promise<{
  queryHash: string;
  aaReq: string;
  key: Buffer;
}> => {
  const current = await getCrypto();
  const ts = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
  const payload = {
    v: 1,
    ts,
    epoch: current.epoch,
    buildId: current.buildId,
    qh: current.queryHash,
  };
  const iv = createHash("sha256")
    .update(`${current.epoch}:${current.buildId}:${current.queryHash}:${ts}`)
    .digest()
    .subarray(0, 12);
  const cipher = createCipheriv("aes-256-gcm", current.key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload)),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const aaReq = Buffer.concat([
    Buffer.from([0x01]),
    iv,
    ciphertext,
    tag,
  ]).toString("base64");

  return { queryHash: current.queryHash, aaReq, key: current.key };
};

export const decryptAllanimeTobeparsedGcm = (
  blobBase64: string,
  aaReqKey: Buffer,
): unknown => {
  const blob = Buffer.from(blobBase64, "base64");
  if (blob.length < 1 + 12 + 16) {
    throw new Error("AllAnime encrypted payload is too short");
  }

  const iv = blob.subarray(1, 13);
  const tag = blob.subarray(blob.length - 16);
  const ciphertext = blob.subarray(13, blob.length - 16);

  for (const candidate of [aaReqKey, RESPONSE_STATIC_KEY]) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", candidate, iv);
      decipher.setAuthTag(tag);
      const plain = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
      return JSON.parse(plain) as unknown;
    } catch {
      continue;
    }
  }

  throw new Error("tobeparsed could not be decrypted with any known key");
};

export const fetchAllanimeEpisodeSources = async (variables: {
  showId: string;
  translationType: "sub" | "dub";
  episodeString: string;
}): Promise<{
  sourceUrls: Array<{
    sourceUrl?: string;
    sourceName?: string;
    type?: string;
    downloadUrl?: string;
    priority?: number;
  }>;
}> => {
  const { queryHash, aaReq, key } = await buildAllanimeAaReq();
  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: queryHash },
      aaReq,
    }),
  });

  let lastError: string | null = null;

  for (const apiHost of ALLANIME_API_HOSTS) {
    const response = await scrapeFetch(`${apiHost}?${params.toString()}`, {
      method: "GET",
      headers: {
        Referer: MKISSA_URL,
        Origin: "https://mkissa.to",
      },
      retryAttempts: 1,
    });

    if (!response.ok) {
      await cancelResponseBody(response);
      lastError = `AllManga episode query failed (${response.status})`;
      continue;
    }

    const raw = (await response.json()) as {
      errors?: Array<{ message?: string; extensions?: { code?: string } }>;
      data?: { tobeparsed?: string; episode?: { sourceUrls?: unknown[] } };
    };

    const cryptoError = raw.errors?.some((error) =>
      /AA_CRYPTO|PERSISTED_QUERY/i.test(
        error.message ?? error.extensions?.code ?? "",
      ),
    );
    if (cryptoError) {
      invalidateAllanimeAaReqCache();
      lastError = raw.errors?.[0]?.message ?? "AllAnime crypto error";
      continue;
    }

    if (raw.data?.tobeparsed) {
      try {
        const decrypted = decryptAllanimeTobeparsedGcm(
          raw.data.tobeparsed,
          key,
        );
        const record = decrypted as {
          episode?: {
            sourceUrls?: Array<{
              sourceUrl?: string;
              sourceName?: string;
              type?: string;
              downloadUrl?: string;
              priority?: number;
            }>;
          };
        };
        return { sourceUrls: record.episode?.sourceUrls ?? [] };
      } catch {
        invalidateAllanimeAaReqCache();
        lastError = "AllAnime tobeparsed decrypt failed";
        continue;
      }
    }

    return {
      sourceUrls:
        (raw.data?.episode?.sourceUrls as Array<{
          sourceUrl?: string;
          sourceName?: string;
          type?: string;
          downloadUrl?: string;
          priority?: number;
        }>) ?? [],
    };
  }

  if (lastError) {
    throw new Error(lastError);
  }

  return { sourceUrls: [] };
};
