/**
 * AllAnime episode-source aaReq token (AES-GCM).
 *
 * Protocol (2026-03): build `140`, boot prefix `4X2PsZc2r:`, lane `k7`, weekly epoch,
 * x-aa-boot HMAC over `group.host.lane.buildId.epoch`, payload includes `k`,
 * IV = sha256(epoch:buildId:qh:ts:k)[:12]. Persisted episode hashes 404; POST the
 * full GraphQL document with extensions.{k,aaReq}.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
} from "node:crypto";

import { cancelResponseBody, scrapeFetch, scrapeFetchText } from "../fetch";
import { scrapeProxyUrl } from "../proxy";

const MKISSA_URL = "https://mkissa.to/";
const MKISSA_HOST = "mkissa.to";
const MKISSA_KEY_GROUP = "mkissa";
const CDN_IMMUTABLE = "https://cdn.allanime.day/all/mk/_app/immutable/";
const BOOTSTRAP_ORIGIN = "https://api.mkissa.net";
const ALLANIME_API_HOSTS = [
  "https://api.mkissa.net/api",
  "https://api.allanime.day/api",
] as const;

export const ALLANIME_EPISODE_LANE = "k7";
const FALLBACK_BUILD_ID = "140";
export const ALLANIME_BOOT_PREFIX = "4X2PsZc2r:";
const ALLANIME_SALT_MUL = 250;
const ALLANIME_SALT_ADD = 54;
const ALLANIME_FRAG_MUL = 16;
const ALLANIME_FRAG_ADD = 217;
export const ALLANIME_FALLBACK_MASK_PARTS = [
  "VfAQPinN3/Q=",
  "R7d6L9MUgM8=",
  "unPepPUGy18=",
  "XXGHwHlzibA=",
] as const;

export const ALLANIME_EPISODE_QUERY_FALLBACK =
  "query(\n$showId: String!\n$translationType: VaildTranslationTypeEnumType!\n$episodeString: String!\n) {\nepisode(\nshowId: $showId\ntranslationType: $translationType\nepisodeString: $episodeString\n) {\nepisodeString\nuploadDate\nsourceUrls\nthumbnail\nnotes\nshow{\n_id\nname\nenglishName\nnativeName\nslugTime\n\nthumbnail\ntbObj {\n  u\n  sm\n  md\n  ts\n}\n\nlastEpisodeInfo\nlastEpisodeDate\ntype\nseason\nscore\nairedStart\navailableEpisodes\nepisodeDuration\nepisodeCount\n# lastUpdateStart\nlastUpdateEnd\ncharacterCount\nplaylistCount\ntierListCount\nworldMapCount\n\ndescription\nbroadcastInterval\nbanner\ncharacters\navailableEpisodesDetail\nnameOnlyString\ncharacters\nisAdult\nrelatedShows\nrelatedMangas\naltNames\ndisqusIds\n}\npageStatus{\n_id\nnotes\npageId\nshowId\n\n# ranks:[Object]\nviews\nlikesCount\ncommentCount\ndislikesCount\nboostsCount\nreviewCount\nuserScoreCount\nuserScoreTotalValue\nuserScoreAverValue\nviewers{\nfirstViewers{\nviewCount\nlastWatchedDate\nuser{\n      _id\n  username\n  displayName\n  createdAt\n  picture\n  reputation\n  roleLevel\n\n  \n  brief\n  followerCount\n  followingCount\n  pDec\n  equippedBadgeKey\n  equippedBadge {\n      key\n  name\n  rank\n  iconPath\n  date\n    badgeUi {\n    markKind\n    tone\n    shine\n    shineRate\n  }\n\n\n  }\n    ugcContributorStats {\n    mediaEditReviewSubmitCount\n    mediaEditApprovedCount\n    mediaEditRejectedCount\n    mediaEditAppliedCount\n    mediaEditContributionPoints\n    mediaEditModContributionPoints\n  }\n\n\n  hideMe\n\n}\n}\nrecViewers{\nviewCount\nlastWatchedDate\nuser{\n      _id\n  username\n  displayName\n  createdAt\n  picture\n  reputation\n  roleLevel\n\n  \n  brief\n  followerCount\n  followingCount\n  pDec\n  equippedBadgeKey\n  equippedBadge {\n      key\n  name\n  rank\n  iconPath\n  date\n    badgeUi {\n    markKind\n    tone\n    shine\n    shineRate\n  }\n\n\n  }\n    ugcContributorStats {\n    mediaEditReviewSubmitCount\n    mediaEditApprovedCount\n    mediaEditRejectedCount\n    mediaEditAppliedCount\n    mediaEditContributionPoints\n    mediaEditModContributionPoints\n  }\n\n\n  hideMe\n\n}\n}\n}\n\n}\nepisodeInfo{\nnotes\nthumbnails\ntbObj {\n  u\n  sm\n  md\n  ts\n}\n\nvidInforssub\nuploadDates\nvidInforsdub\nvidInforsraw\ndescription\n}\nversionFix\n}\n}\n";

export const ALLANIME_EPISODE_QUERY_HASH_FALLBACK = createHash("sha256")
  .update(ALLANIME_EPISODE_QUERY_FALLBACK)
  .digest("hex");

const RESPONSE_STATIC_KEY = createHash("sha256")
  .update("Xot36i3lK3:v1")
  .digest();

const WINDOW_MS = 300_000;
const WEEK_MS = 604_800_000;

type CachedCrypto = {
  expiresMs: number;
  epoch: number;
  buildId: string;
  key: Buffer;
  queryHash: string;
  query: string;
  lane: string;
};

let cache: CachedCrypto | null = null;

export const hashAllanimeQuery = (query: string): string =>
  createHash("sha256").update(query).digest("hex");

/** Legacy XOR of a 64-hex mask with bootstrap partB. */
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

export const deriveAllanimeBuildSeed = (buildId: string): Buffer => {
  const normalized = String(buildId);
  const seed = Buffer.alloc(32);
  for (let index = 0; index < 32; index += 1) {
    const code =
      normalized.charCodeAt(index % Math.max(normalized.length, 1)) || 0;
    seed[index] =
      code ^ ((index * ALLANIME_SALT_MUL + ALLANIME_SALT_ADD) & 255);
  }
  return seed;
};

export const deriveAllanimeMaskKey = (
  maskParts: readonly string[],
  buildId: string,
): Buffer => {
  const seed = deriveAllanimeBuildSeed(buildId);
  const key = Buffer.alloc(32);
  for (let part = 0; part < 4; part += 1) {
    const bytes = Buffer.from(maskParts[part] ?? "", "base64");
    for (let offset = 0; offset < 8; offset += 1) {
      const index = part * 8 + offset;
      key[index] =
        (bytes[offset] ?? 0) ^
        (seed[index] ?? 0) ^
        ((part * ALLANIME_FRAG_MUL + offset * ALLANIME_FRAG_ADD) & 255);
    }
  }
  return key;
};

export const deriveAllanimeLaneKey = (
  maskParts: readonly string[],
  buildId: string,
  partBBase64: string,
): Buffer => {
  const maskKey = deriveAllanimeMaskKey(maskParts, buildId);
  const partB = Buffer.from(partBBase64, "base64");
  const key = Buffer.alloc(32);
  for (let index = 0; index < 32; index += 1) {
    key[index] = (maskKey[index] ?? 0) ^ (partB[index] ?? 0);
  }
  return key;
};

export const buildAllanimeBootToken = (
  maskKey: Buffer,
  buildId: string,
  epoch: number,
  lane: string,
  keyGroup = MKISSA_KEY_GROUP,
  host = MKISSA_HOST,
): string => {
  const inner = createHmac("sha256", maskKey)
    .update(`${ALLANIME_BOOT_PREFIX}${buildId}`)
    .digest();
  return createHmac("sha256", inner)
    .update([keyGroup, host, lane, buildId, String(epoch)].join("."))
    .digest("hex");
};

const identifierBoundary = (name: string): string => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `(?<![\\w$])${escaped}`;
};

export const resolveAllanimeSourceQuery = (chunkJs: string): string | null => {
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
  return query;
};

/** Assemble template-literal GraphQL docs the way the AllAnime chunk does. */
export const resolveAllanimeSourceQueryHash = (
  chunkJs: string,
): string | null => {
  const query = resolveAllanimeSourceQuery(chunkJs);
  return query ? hashAllanimeQuery(query) : null;
};

const ALLANIME_VC_ROTATION_TARGET = -399417 + -3034 * -179 + -8 * -50659;
const ALLANIME_VC_OFFSET = 1865 * -5 + -1 * 361 + -2461 * -4;

const extractAllanimeVcStringTable = (chunkJs: string): string[] | null => {
  const match = chunkJs.match(
    /function vc\(\)\{const e=\[([\s\S]*?)\];return vc=function\(\)\{return e\},vc\(\)\}/,
  );
  if (!match?.[1]) {
    return null;
  }

  try {
    const table = eval(`[${match[1]}]`) as unknown;
    return Array.isArray(table) ? table.map(String) : null;
  } catch {
    return null;
  }
};

const rotateAllanimeVcStringTable = (table: string[]): string[] => {
  const rotated = [...table];
  for (let attempt = 0; attempt < rotated.length + 8; attempt += 1) {
    const lookup = (index: number): string | undefined =>
      rotated[index - ALLANIME_VC_OFFSET];
    const n = (_left: number, right: number) => lookup(right + 765) ?? "0";
    const a = (left: number, _right: number) => lookup(left - 425) ?? "0";

    try {
      const check =
        (-parseInt(n(-396, -490), 10) / 1) * (-parseInt(a(686, 779), 10) / 2) +
        (parseInt(n(-552, -574), 10) / 3) * (-parseInt(a(623, 556), 10) / 4) +
        (parseInt(a(682, 604), 10) / 5) * (-parseInt(n(-419, -421), 10) / 6) +
        -parseInt(n(-523, -478), 10) / 7 +
        (parseInt(a(604, 654), 10) / 8) * (parseInt(n(-402, -459), 10) / 9) +
        -parseInt(a(639, 655), 10) / 10 +
        (-parseInt(n(-503, -555), 10) / 11) *
          (-parseInt(n(-488, -470), 10) / 12);
      if (check === ALLANIME_VC_ROTATION_TARGET) {
        return rotated;
      }
    } catch {
      void 0;
    }

    rotated.push(rotated.shift() ?? "");
  }

  return rotated;
};

const createAllanimeStringDecoder = (table: string[]) => {
  const lookup = (index: number): string =>
    table[index - ALLANIME_VC_OFFSET] ?? "";
  return {
    tr: (_left: number, right: number) => lookup(right + 80),
    nr: (_left: number, right: number) => lookup(right - 551),
  };
};

const evaluateAllanimeLiteralExpression = (
  expression: string,
  decode: ReturnType<typeof createAllanimeStringDecoder>,
): string =>
  [...expression.matchAll(/(?:Tr|nr)\((-?\d+),(-?\d+)\)/g)].reduce(
    (value, match) => {
      const left = Number(match[1]);
      const right = Number(match[2]);
      const decoded =
        match[0]?.startsWith("nr(") === true
          ? decode.nr(left, right)
          : decode.tr(left, right);
      return value + decoded;
    },
    "",
  );

const ALLANIME_WF_ENTRY_PATTERN =
  /(?:Tr|nr)\([^)]+\)(?:\+(?:Tr|nr)\([^)]+\))*/g;

const extractAllanimeWfEntries = (chunkJs: string): string[] => {
  const match = chunkJs.match(/wf=\[([\s\S]*?)\]/);
  if (!match?.[1]) {
    return [];
  }

  return [...match[1].matchAll(ALLANIME_WF_ENTRY_PATTERN)].map(
    (entry) => entry[0] ?? "",
  );
};

const discoverAllanimeChunkLiterals = (
  chunkJs: string,
): { buildId: string; maskParts: string[] } | null => {
  const table = extractAllanimeVcStringTable(chunkJs);
  if (!table) {
    return null;
  }

  const decode = createAllanimeStringDecoder(
    rotateAllanimeVcStringTable(table),
  );
  const buildId = decode.tr(152, 159).trim();
  const wfEntries = extractAllanimeWfEntries(chunkJs);
  if (!buildId || wfEntries.length === 0) {
    return null;
  }

  const maskParts = wfEntries
    .map((entry) => evaluateAllanimeLiteralExpression(entry, decode))
    .filter((part) => Buffer.from(part, "base64").length === 8);

  if (maskParts.length !== 4) {
    return null;
  }

  return { buildId, maskParts };
};

export const extractAllanimeBuildId = (chunkJs: string): string | null => {
  const discovered = discoverAllanimeChunkLiterals(chunkJs);
  if (discovered?.buildId) {
    return discovered.buildId;
  }

  const modern = chunkJs.match(
    /!==\s*["']string["']\s*\?\s*["'](\d{1,8})["']\s*:\s*["']["']/,
  );
  if (modern?.[1]) {
    return modern[1];
  }
  const legacy = chunkJs.match(
    /gr\s*=\s*[^?]*\?\s*["'](\d{1,8})["']\s*:\s*["']["']/,
  );
  return legacy?.[1] ?? null;
};

export const extractAllanimeMaskParts = (chunkJs: string): string[] | null => {
  const discovered = discoverAllanimeChunkLiterals(chunkJs);
  if (discovered?.maskParts) {
    return discovered.maskParts;
  }

  const quoted = [...chunkJs.matchAll(/["']([A-Za-z0-9+/]{11}=)["']/g)].map(
    (match) => match[1] ?? "",
  );
  for (let index = 0; index + 3 < quoted.length; index += 1) {
    const window = quoted.slice(index, index + 4);
    if (window.every((part) => Buffer.from(part, "base64").length === 8)) {
      return window;
    }
  }
  return null;
};

type BootstrapPayload = {
  partB: string;
  epoch: number;
  switchAt: number;
  graceMs: number;
};

const fetchBootstrap = async (
  buildId: string,
  maskKey: Buffer,
  lane: string,
): Promise<BootstrapPayload | null> => {
  const currentEpoch = Math.floor(Date.now() / WEEK_MS);
  const epochs = [currentEpoch, currentEpoch - 1];

  for (const epoch of epochs) {
    const token = buildAllanimeBootToken(maskKey, buildId, epoch, lane);
    try {
      const response = await scrapeFetch(
        `${BOOTSTRAP_ORIGIN}/client-crypto/v1/bootstrap?buildId=${encodeURIComponent(buildId)}&k=${encodeURIComponent(lane)}`,
        {
          headers: {
            Accept: "application/json",
            "x-build-id": buildId,
            "x-aa-boot": token,
            Origin: "https://mkissa.to",
            Referer: MKISSA_URL,
          },
          timeoutMs: 12_000,
          retryAttempts: 1,
        },
      );
      if (!response.ok) {
        await cancelResponseBody(response);
        continue;
      }
      const payload = (await response.json()) as {
        partB?: string;
        epoch?: number;
        switchAt?: number;
        graceMs?: number;
      };
      if (!payload.partB || payload.epoch == null) {
        continue;
      }
      return {
        partB: payload.partB,
        epoch: payload.epoch,
        switchAt: payload.switchAt ?? 0,
        graceMs: payload.graceMs ?? 0,
      };
    } catch {
      continue;
    }
  }

  return null;
};

const discoverChunkCrypto = async (): Promise<{
  buildId: string;
  maskParts: readonly string[];
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

      const looksLikeCrypto = js.text.includes("client-crypto/v1/bootstrap");
      if (!looksLikeCrypto) {
        continue;
      }

      const buildId = extractAllanimeBuildId(js.text) ?? FALLBACK_BUILD_ID;
      const maskParts =
        extractAllanimeMaskParts(js.text) ?? ALLANIME_FALLBACK_MASK_PARTS;

      return { buildId, maskParts };
    }

    return null;
  } catch {
    return null;
  }
};

const fetchLiveCrypto = async (): Promise<CachedCrypto | null> => {
  const discovered = await discoverChunkCrypto();
  const buildId = discovered?.buildId ?? FALLBACK_BUILD_ID;
  const maskParts = discovered?.maskParts ?? ALLANIME_FALLBACK_MASK_PARTS;
  const query = ALLANIME_EPISODE_QUERY_FALLBACK;
  const lane = ALLANIME_EPISODE_LANE;
  const maskKey = deriveAllanimeMaskKey(maskParts, buildId);

  const bootstrap = await fetchBootstrap(buildId, maskKey, lane);
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
    key: deriveAllanimeLaneKey(maskParts, buildId, bootstrap.partB),
    queryHash: hashAllanimeQuery(query),
    query,
    lane,
  };
};

const getCrypto = async (): Promise<CachedCrypto> => {
  if (cache && cache.expiresMs > Date.now()) {
    return cache;
  }

  const live = await fetchLiveCrypto();
  if (!live) {
    throw new Error("AllAnime crypto bootstrap failed");
  }

  cache = live;
  return live;
};

export const invalidateAllanimeAaReqCache = (): void => {
  cache = null;
};

export const buildAllanimeAaReq = async (): Promise<{
  queryHash: string;
  query: string;
  aaReq: string;
  key: Buffer;
  buildId: string;
  lane: string;
}> => {
  const current = await getCrypto();
  const ts = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
  const payload = {
    v: 1,
    ts,
    epoch: current.epoch,
    buildId: current.buildId,
    qh: current.queryHash,
    k: current.lane,
  };
  const iv = createHash("sha256")
    .update(
      `${current.epoch}:${current.buildId}:${current.queryHash}:${ts}:${current.lane}`,
    )
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

  return {
    queryHash: current.queryHash,
    query: current.query,
    aaReq,
    key: current.key,
    buildId: current.buildId,
    lane: current.lane,
  };
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

export const isAllanimeCaptchaMessage = (value: string | undefined): boolean =>
  Boolean(value && /NEED_CAPTCHA|CAPTCHA_REQUIRED/i.test(value));

const captchaErrorMessage = (
  errors:
    | Array<{ message?: string; extensions?: { code?: string } }>
    | undefined,
): string | null => {
  const match = errors?.find(
    (error) =>
      isAllanimeCaptchaMessage(error.message) ||
      isAllanimeCaptchaMessage(error.extensions?.code),
  );
  return match
    ? (match.message ?? match.extensions?.code ?? "NEED_CAPTCHA")
    : null;
};

type AllanimeEpisodeSource = {
  sourceUrl?: string;
  sourceName?: string;
  type?: string;
  downloadUrl?: string;
  priority?: number;
};

const asEpisodeSources = (value: unknown): AllanimeEpisodeSource[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is AllanimeEpisodeSource => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const record = entry as Record<string, unknown>;
    return typeof record.sourceUrl === "string";
  });
};

export const extractAllanimeDecryptedSources = (
  decrypted: unknown,
): AllanimeEpisodeSource[] => {
  if (!decrypted || typeof decrypted !== "object") {
    return [];
  }
  const record = decrypted as Record<string, unknown>;
  const nested = record.episode;
  if (nested && typeof nested === "object") {
    const fromEpisode = asEpisodeSources(
      (nested as Record<string, unknown>).sourceUrls,
    );
    if (fromEpisode.length > 0) {
      return fromEpisode;
    }
  }
  return asEpisodeSources(record.sourceUrls);
};

type AllanimeEpisodeQueryResult =
  | { kind: "ok"; sourceUrls: AllanimeEpisodeSource[] }
  | { kind: "captcha"; message: string }
  | { kind: "error"; lastError: string | null };

const queryAllanimeEpisodeHosts = async (
  variables: {
    showId: string;
    translationType: "sub" | "dub";
    episodeString: string;
  },
  crypto: {
    query: string;
    aaReq: string;
    key: Buffer;
    buildId: string;
    lane: string;
  },
  forceProxy: boolean,
): Promise<AllanimeEpisodeQueryResult> => {
  let lastError: string | null = null;

  for (const apiHost of ALLANIME_API_HOSTS) {
    const response = await scrapeFetch(apiHost, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: MKISSA_URL,
        Origin: "https://mkissa.to",
        "x-build-id": crypto.buildId,
      },
      body: JSON.stringify({
        query: crypto.query,
        variables,
        extensions: { k: crypto.lane, aaReq: crypto.aaReq },
      }),
      retryAttempts: 1,
      forceProxy,
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

    const captcha = captchaErrorMessage(raw.errors);
    if (captcha) {
      return { kind: "captcha", message: captcha };
    }

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

    if (raw.errors?.[0]?.message && !raw.data?.tobeparsed) {
      lastError = raw.errors[0].message;
      continue;
    }

    if (raw.data?.tobeparsed) {
      try {
        const decrypted = decryptAllanimeTobeparsedGcm(
          raw.data.tobeparsed,
          crypto.key,
        );
        const sourceUrls = extractAllanimeDecryptedSources(decrypted);
        if (sourceUrls.length > 0) {
          return { kind: "ok", sourceUrls };
        }
        lastError = "AllAnime tobeparsed had no sourceUrls";
        continue;
      } catch {
        invalidateAllanimeAaReqCache();
        lastError = "AllAnime tobeparsed decrypt failed";
        continue;
      }
    }

    const plaintext = asEpisodeSources(raw.data?.episode?.sourceUrls);
    if (plaintext.length > 0) {
      return { kind: "ok", sourceUrls: plaintext };
    }
    lastError = lastError ?? "AllManga returned no source URLs";
  }

  return { kind: "error", lastError };
};

export const fetchAllanimeEpisodeSources = async (variables: {
  showId: string;
  translationType: "sub" | "dub";
  episodeString: string;
}): Promise<{
  sourceUrls: AllanimeEpisodeSource[];
}> => {
  const crypto = await buildAllanimeAaReq();
  const result = await queryAllanimeEpisodeHosts(
    variables,
    crypto,
    Boolean(scrapeProxyUrl()),
  );

  switch (result.kind) {
    case "ok":
      return { sourceUrls: result.sourceUrls };
    case "captcha":
      throw new Error(result.message);
    case "error":
      if (result.lastError) {
        throw new Error(result.lastError);
      }
      return { sourceUrls: [] };
    default: {
      const exhaustive: never = result;
      throw new Error(`Unhandled AllAnime episode result: ${exhaustive}`);
    }
  }
};
