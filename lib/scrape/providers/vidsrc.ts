import { scrapeFetch, scrapeFetchText } from "../fetch";
import { probeScrapePlaybackPath } from "../playback-probe";
import type { ScrapeMediaInput, ScrapeResult } from "../types";
import type { VidsrcPlaybackRefresh } from "../vidsrc-constants";

export const VIDSRC_MIRROR_EMBED_ORIGIN = "https://vidsrc-embed.ru";
const STREAM_API_ORIGIN = "https://data.vidsrcme.ru";
const PLAYER_ORIGIN = "https://cloudorchestranova.com";
const VIDSRC_WASM_NONCE_BYTES = 12;

export const buildVidsrcStreamApiUrl = (input: ScrapeMediaInput): string => {
  const params = new URLSearchParams();
  switch (input.mediaType) {
    case "movie":
      params.set("type", "movie");
      params.set("tmdb", String(input.tmdbId));
      break;
    case "tv":
      params.set("type", "tv");
      params.set("tmdb", String(input.tmdbId));
      params.set("season", String(input.seasonNumber ?? 1));
      params.set("episode", String(input.episodeNumber ?? 1));
      break;
    default: {
      const exhaustive: never = input.mediaType;
      throw new Error(`Unsupported VidSrc media type: ${exhaustive}`);
    }
  }

  return `${STREAM_API_ORIGIN}/api.php?${params.toString()}&stream_urls`;
};

export type VidsrcStreamApiPayload = {
  status_code?: string;
  data?: {
    stream_urls?: string | string[];
  };
  vs?: {
    w?: number;
    wasm_url?: string;
    wasm?: string;
  };
};

export type VidsrcStreamCandidates = {
  plaintext: string[];
  encrypted: string | null;
  wasmUrl: string | null;
  wasmInline: string | null;
};

export const collectVidsrcStreamUrlCandidates = (
  payload: VidsrcStreamApiPayload,
): VidsrcStreamCandidates => {
  const raw = payload.data?.stream_urls;
  if (Array.isArray(raw)) {
    return {
      plaintext: raw.filter(
        (url): url is string =>
          typeof url === "string" && /^https?:\/\//.test(url),
      ),
      encrypted: null,
      wasmUrl: null,
      wasmInline: null,
    };
  }

  if (typeof raw === "string" && (payload.vs?.wasm_url || payload.vs?.wasm)) {
    return {
      plaintext: [],
      encrypted: raw,
      wasmUrl: payload.vs.wasm_url ?? null,
      wasmInline: payload.vs.wasm ?? null,
    };
  }

  if (typeof raw === "string") {
    return {
      plaintext: raw.split("\n").filter((url) => /^https?:\/\//.test(url)),
      encrypted: null,
      wasmUrl: null,
      wasmInline: null,
    };
  }

  return {
    plaintext: [],
    encrypted: null,
    wasmUrl: null,
    wasmInline: null,
  };
};

export const parseVidsrcTokenResponse = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("<")) {
    return "";
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === "string") {
        return parsed.startsWith("<") ? "" : parsed;
      }
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        for (const key of ["token", "data", "string", "result"] as const) {
          const value = record[key];
          if (
            typeof value === "string" &&
            value.length > 0 &&
            !value.startsWith("<")
          ) {
            return value;
          }
        }
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
};

export const applyVidsrcStreamToken = (url: string, token: string): string => {
  if (!token) {
    return url;
  }
  if (url.includes("__TOKEN__") || url.includes("__TOKENPG__")) {
    return url.replaceAll("__TOKEN__", token).replaceAll("__TOKENPG__", token);
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${token}`;
};

const normalizeEmbedSrc = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "about:blank") {
    return null;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith("http")) {
    return trimmed;
  }

  return null;
};

export const extractIframeSrc = (html: string): string | null => {
  const playerIframeTag = html.match(
    /<iframe\b[^>]*\bid=["']player_iframe["'][^>]*>/i,
  );
  if (playerIframeTag?.[0]) {
    const srcMatch = playerIframeTag[0].match(/\bsrc=["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      const normalized = normalizeEmbedSrc(srcMatch[1]);
      if (normalized) {
        return normalized;
      }
    }
  }

  const playerPatterns = [
    /src=["']([^"']*(?:cloudorchestranova|\/rcp\/|\/prorcp\/|\/embed\/(?:movie|tv|player))[^"']*)["']/i,
    /src=["']([^"']+)["']/i,
  ];

  for (const pattern of playerPatterns) {
    const match = html.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const normalized = normalizeEmbedSrc(match[1]);
    if (normalized && !normalized.includes("cdnjs.cloudflare.com")) {
      return normalized;
    }
  }

  return null;
};

type VidsrcWasmExports = {
  memory: WebAssembly.Memory;
  alloc: (length: number) => number;
  decrypt: (ptr: number, length: number) => number;
};

const getVidsrcWasmExports = (
  instance: WebAssembly.Instance,
): VidsrcWasmExports | null => {
  const memory = instance.exports.memory;
  const alloc = instance.exports.alloc;
  const decrypt = instance.exports.decrypt;
  if (
    !(memory instanceof WebAssembly.Memory) ||
    typeof alloc !== "function" ||
    typeof decrypt !== "function"
  ) {
    return null;
  }

  return {
    memory,
    alloc: (length: number) => Number(alloc(length)),
    decrypt: (ptr: number, length: number) => Number(decrypt(ptr, length)),
  };
};

const decodeBase64Bytes = (value: string): Uint8Array => {
  const buffer = Buffer.from(value, "base64");
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
};

const decryptVidsrcStreamUrls = async (
  encrypted: string,
  wasmUrl: string | null,
  wasmInline: string | null,
): Promise<string[]> => {
  let wasmBytes: Uint8Array | null = null;
  if (wasmUrl) {
    const wasmResponse = await scrapeFetch(wasmUrl, {
      headers: {
        Referer: `${PLAYER_ORIGIN}/`,
        Accept: "*/*",
      },
    });
    if (wasmResponse.ok) {
      wasmBytes = new Uint8Array(await wasmResponse.arrayBuffer());
    }
  }
  if ((!wasmBytes || wasmBytes.byteLength === 0) && wasmInline) {
    wasmBytes = decodeBase64Bytes(wasmInline);
  }
  if (!wasmBytes || wasmBytes.byteLength === 0) {
    return [];
  }

  const module = await WebAssembly.compile(Uint8Array.from(wasmBytes));
  const instance = new WebAssembly.Instance(module, {});
  const exports = getVidsrcWasmExports(instance);
  if (!exports) {
    return [];
  }

  const encryptedBytes = decodeBase64Bytes(encrypted);
  const ptr = exports.alloc(encryptedBytes.byteLength);
  new Uint8Array(exports.memory.buffer, ptr, encryptedBytes.byteLength).set(
    encryptedBytes,
  );
  const outLen = exports.decrypt(ptr, encryptedBytes.byteLength);
  if (!Number.isFinite(outLen) || outLen <= 0) {
    return [];
  }

  const plaintext = new TextDecoder().decode(
    new Uint8Array(
      exports.memory.buffer,
      ptr + VIDSRC_WASM_NONCE_BYTES,
      outLen,
    ),
  );
  return plaintext.split("\n").filter((url) => /^https?:\/\//.test(url));
};

const tokenHostFromUrl = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const fetchVidsrcJwt = async (tokenHost: string): Promise<string> => {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await sleep(1_500);
    }
    const tokenResponse = await scrapeFetchText(
      `https://${tokenHost}/generate.php`,
      { Referer: `${PLAYER_ORIGIN}/` },
    );
    const token = parseVidsrcTokenResponse(tokenResponse.text);
    if (token) {
      return token;
    }
    if (tokenResponse.status !== 429 && tokenResponse.status !== 503) {
      return "";
    }
  }
  return "";
};

const mintVidsrcStream = async (
  rawStreamUrl: string,
  tokenCache: Map<string, string>,
): Promise<ScrapeResult | null> => {
  const tokenHost = tokenHostFromUrl(rawStreamUrl);
  if (!tokenHost) {
    return null;
  }

  let token = tokenCache.get(tokenHost);
  if (!token) {
    token = await fetchVidsrcJwt(tokenHost);
    if (!token) {
      return null;
    }
    tokenCache.set(tokenHost, token);
  }

  const masterTemplate = applyVidsrcStreamToken(rawStreamUrl, "__TOKEN__");
  const streamUrl = applyVidsrcStreamToken(rawStreamUrl, token);
  const playbackRefresh: VidsrcPlaybackRefresh = {
    providerId: "vidsrc",
    tokenHost,
    masterTemplate,
    playerOrigin: PLAYER_ORIGIN,
    playerReferer: `${PLAYER_ORIGIN}/`,
  };

  return {
    ok: true,
    providerId: "vidsrc",
    streamUrl,
    referer: `${PLAYER_ORIGIN}/`,
    playbackRefresh,
  };
};

const scrapeVidSrcFromApi = async (
  input: ScrapeMediaInput,
): Promise<ScrapeResult> => {
  const providerId = "vidsrc";
  const api = await scrapeFetchText(buildVidsrcStreamApiUrl(input), {
    Accept: "application/json",
    Referer: `${PLAYER_ORIGIN}/`,
  });

  if (api.status !== 200) {
    return {
      ok: false,
      providerId,
      error: `VidSrc stream API failed (${api.status})`,
    };
  }

  let payload: VidsrcStreamApiPayload;
  try {
    payload = JSON.parse(api.text) as VidsrcStreamApiPayload;
  } catch {
    return {
      ok: false,
      providerId,
      error: "VidSrc stream API returned invalid JSON",
    };
  }

  const candidates = collectVidsrcStreamUrlCandidates(payload);
  let streamUrls = candidates.plaintext;
  if (streamUrls.length === 0 && candidates.encrypted) {
    streamUrls = await decryptVidsrcStreamUrls(
      candidates.encrypted,
      candidates.wasmUrl,
      candidates.wasmInline,
    );
  }

  if (streamUrls.length === 0) {
    return { ok: false, providerId, error: "VidSrc stream URLs missing" };
  }

  let mintedAny = false;
  const tokenCache = new Map<string, string>();
  for (const rawStreamUrl of streamUrls) {
    const minted = await mintVidsrcStream(rawStreamUrl, tokenCache);
    if (!minted?.ok) {
      continue;
    }
    mintedAny = true;
    const playable = await probeScrapePlaybackPath(
      {
        url: minted.streamUrl,
        referer: minted.referer ?? `${PLAYER_ORIGIN}/`,
      },
      "hls",
    );
    if (playable) {
      return { ...minted, validated: true };
    }
  }

  return {
    ok: false,
    providerId,
    error: mintedAny
      ? "VidSrc stream URLs failed validation"
      : "VidSrc JWT token missing",
  };
};

export async function scrapeVidSrc(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  try {
    return await scrapeVidSrcFromApi(input);
  } catch (error) {
    return {
      ok: false,
      providerId: "vidsrc",
      error:
        error instanceof Error
          ? error.message
          : "VidSrc scrape failed unexpectedly",
    };
  }
}

/** Same API path as scrapeVidSrc — 2Embed uses this as a stream fallback. */
export async function scrapeVidSrcMirrorEmbed(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  return scrapeVidSrc(input);
}
