import { cancelResponseBody, scrapeFetch } from "./fetch";
import {
  VIDEASY_PLAYER_ORIGIN,
  VIDKING_PLAYER_ORIGIN,
  getVideasyPlayerOrigin,
  getVidkingPlayerOrigin,
  getWingsApiBase,
  wingsApiHeaders,
  wingsSeedUrl,
} from "./vidking-constants";
import {
  getWingsApiRuntime,
  registerWingsApiHostname,
  resetWingsApiRuntime,
  setWingsApiRuntime,
  type WingsApiRuntime,
} from "./wings-api-runtime";

export const WINGS_DISCOVER_TTL_MS = 6 * 60 * 60 * 1000;
export const WINGS_DISCOVER_FAIL_COOLDOWN_MS = 60_000;

const PLAYER_TLDS = ["to", "net", "com", "cc", "app", "pro", "tv"] as const;
const BLOCKED_API_HOSTS =
  /(?:themoviedb\.org|tmdb\.org|github\.com|googleapis\.com|cloudflare\.com|wingsdatabase\.com)$/i;
const API_BASE_PATTERN = /https:\/\/api\.[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const PLAYER_ORIGIN_PATTERN =
  /https:\/\/(?:player\.videasy|www\.vidking|vidking)\.[a-z]{2,6}/gi;
const SCRIPT_SRC_PATTERN = /<script\b[^>]*\bsrc=["']([^"']+)["']/gi;

export type WingsPlayerKind = "videasy" | "vidking";

export type WingsSeedResult =
  | { ok: true; seed: string; origin: string }
  | { ok: false; error: string; status?: number; network?: boolean };

const originOf = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const hostnameOf = (value: string): string | null => {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
};

const unique = (values: string[]): string[] => [...new Set(values)];

export const expandPlayerOriginCandidates = (origin: string): string[] => {
  const parsed = originOf(origin);
  if (!parsed) {
    return [];
  }

  const url = new URL(parsed);
  const labels = url.hostname.split(".");
  if (labels.length < 2) {
    return [parsed];
  }

  const rest = labels.slice(0, -1);
  const hosts = new Set<string>([url.hostname]);

  for (const tld of PLAYER_TLDS) {
    hosts.add(`${rest.join(".")}.${tld}`);
  }

  if (rest[0] === "www" && rest.length > 1) {
    const withoutWww = rest.slice(1);
    for (const tld of PLAYER_TLDS) {
      hosts.add(`${withoutWww.join(".")}.${tld}`);
    }
  } else if (rest.length === 1) {
    for (const tld of PLAYER_TLDS) {
      hosts.add(`www.${rest[0]}.${tld}`);
    }
  }

  const ordered = [parsed];
  for (const host of hosts) {
    const candidate = `${url.protocol}//${host}`;
    if (candidate !== parsed) {
      ordered.push(candidate);
    }
  }
  return ordered;
};

export const defaultWingsPlayerOriginCandidates = (
  kind: WingsPlayerKind,
): string[] => {
  if (kind === "videasy") {
    return unique([
      ...expandPlayerOriginCandidates(getVideasyPlayerOrigin()),
      ...expandPlayerOriginCandidates(VIDEASY_PLAYER_ORIGIN),
      ...expandPlayerOriginCandidates("https://player.videasy.net"),
    ]);
  }

  return unique([
    ...expandPlayerOriginCandidates(getVidkingPlayerOrigin()),
    ...expandPlayerOriginCandidates(VIDKING_PLAYER_ORIGIN),
    ...expandPlayerOriginCandidates("https://vidking.net"),
    ...expandPlayerOriginCandidates("https://www.vidking.to"),
  ]);
};

export const extractWingsApiBases = (source: string): string[] => {
  const normalized = source.replace(/\\\//g, "/");
  const found = new Set<string>();
  for (const match of normalized.matchAll(API_BASE_PATTERN)) {
    const base = match[0]?.replace(/\/+$/, "");
    if (!base) {
      continue;
    }
    const hostname = hostnameOf(base);
    if (!hostname || BLOCKED_API_HOSTS.test(hostname)) {
      continue;
    }
    found.add(base);
  }
  return [...found];
};

export const extractPlayerOriginsFromSource = (source: string): string[] => {
  const normalized = source.replace(/\\\//g, "/");
  const found = new Set<string>();
  for (const match of normalized.matchAll(PLAYER_ORIGIN_PATTERN)) {
    const origin = originOf(match[0] ?? "");
    if (origin) {
      found.add(origin);
    }
  }
  return [...found];
};

export const scoreWingsApiBase = (source: string, apiBase: string): number => {
  const haystack = source.replace(/\\\//g, "/");
  const index = haystack.indexOf(apiBase);
  if (index < 0) {
    return 0;
  }

  const window = haystack.slice(
    Math.max(0, index - 160),
    index + apiBase.length + 160,
  );
  let score = 1;
  if (/sources-with-title/i.test(window)) score += 5;
  if (/\/seed/i.test(window)) score += 4;
  if (/\benc\b/i.test(window)) score += 1;
  return score;
};

export const extractScriptSrcs = (html: string, pageUrl: string): string[] => {
  const srcs: string[] = [];
  for (const match of html.matchAll(SCRIPT_SRC_PATTERN)) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith("data:")) {
      continue;
    }
    try {
      srcs.push(new URL(raw, pageUrl).toString());
    } catch {
      continue;
    }
  }
  return srcs;
};

const playerOriginFor = (player: WingsPlayerKind): string => {
  switch (player) {
    case "videasy":
      return getVideasyPlayerOrigin();
    case "vidking":
      return getVidkingPlayerOrigin();
    default: {
      const exhaustive: never = player;
      return exhaustive;
    }
  }
};

const playerProbePaths = (origin: string): string[] => {
  const host = hostnameOf(origin) ?? "";
  if (host.includes("videasy")) {
    return [`${origin}/movie/550`, `${origin}/`];
  }
  if (host.includes("vidking")) {
    return [`${origin}/embed/movie/550`, `${origin}/`];
  }
  return [`${origin}/embed/movie/550`, `${origin}/movie/550`, `${origin}/`];
};

const rankApiBases = (source: string, bases: string[]): string[] =>
  [...bases].sort(
    (left, right) =>
      scoreWingsApiBase(source, right) - scoreWingsApiBase(source, left),
  );

let inflight: Promise<WingsApiRuntime | null> | undefined;
let lastFailAt = 0;

export const resetWingsApiDiscoverState = (): void => {
  inflight = undefined;
  lastFailAt = 0;
  resetWingsApiRuntime();
};

const persistPlayerOrigin = (
  player: WingsPlayerKind,
  origin: string,
  apiBase = getWingsApiBase(),
): void => {
  setWingsApiRuntime({
    apiBase,
    videasyPlayerOrigin:
      player === "videasy" ? origin : getVideasyPlayerOrigin(),
    vidkingPlayerOrigin:
      player === "vidking" ? origin : getVidkingPlayerOrigin(),
    discoveredAt: Date.now(),
  });
};

const fetchText = async (
  url: string,
  headers?: Record<string, string>,
  timeoutMs = 3_500,
): Promise<
  | { url: string; status: number; text: string; network?: undefined }
  | { network: true }
> => {
  try {
    const response = await scrapeFetch(url, {
      headers,
      timeoutMs,
      retryAttempts: 1,
    });
    const text = await response.text();
    return { url: response.url || url, status: response.status, text };
  } catch {
    return { network: true };
  }
};

const collectFromPlayer = async (
  origin: string,
): Promise<{ origin: string; apiBases: string[]; blob: string } | null> => {
  let workingOrigin = origin;
  let blob = "";
  const apiBases = new Set<string>();

  for (const path of playerProbePaths(origin)) {
    const page = await fetchText(path, {
      Accept: "text/html,application/xhtml+xml",
      Referer: `${origin}/`,
    });
    if ("network" in page) {
      break;
    }
    if (page.status >= 400 || page.text.length < 80) {
      continue;
    }

    workingOrigin = originOf(page.url) ?? origin;
    blob += `\n${page.text}`;
    for (const base of extractWingsApiBases(page.text)) {
      apiBases.add(base);
    }

    const scripts = extractScriptSrcs(page.text, page.url)
      .filter((src) => /\.js(\?|$)/i.test(src))
      .slice(0, 8);
    for (const src of scripts) {
      const script = await fetchText(src, { Referer: `${workingOrigin}/` });
      if ("network" in script || script.status >= 400) {
        continue;
      }
      blob += `\n${script.text}`;
      for (const base of extractWingsApiBases(script.text)) {
        apiBases.add(base);
      }
      if (
        apiBases.size > 0 &&
        /sources-with-title|\/seed\?mediaId/i.test(script.text)
      ) {
        break;
      }
    }

    if (apiBases.size > 0 || /videasy|vidking/i.test(page.text)) {
      break;
    }
  }

  if (!blob) {
    return null;
  }

  return {
    origin: workingOrigin,
    apiBases: rankApiBases(blob, [...apiBases]),
    blob,
  };
};

const findFirstPlayerPage = async (
  origins: string[],
): Promise<{ origin: string; apiBases: string[]; blob: string } | null> => {
  const ordered = unique(origins).slice(0, 12);
  const priorityHits = await Promise.all(
    ordered.slice(0, 4).map((origin) => collectFromPlayer(origin)),
  );
  const priorityHit = priorityHits.find((page) => page !== null);
  if (priorityHit) {
    return priorityHit;
  }

  for (const origin of ordered.slice(4)) {
    const page = await collectFromPlayer(origin);
    if (page) {
      return page;
    }
  }
  return null;
};

const probeSeed = async (
  apiBase: string,
  playerOrigin: string,
  tmdbId: number,
): Promise<boolean> => {
  const hostname = hostnameOf(apiBase);
  if (!hostname) {
    return false;
  }
  registerWingsApiHostname(hostname);

  const response = await fetchText(
    `${apiBase.replace(/\/+$/, "")}/seed?mediaId=${encodeURIComponent(String(tmdbId))}`,
    wingsApiHeaders(playerOrigin),
    8_000,
  );
  if ("network" in response || response.status !== 200) {
    return false;
  }

  try {
    const payload = JSON.parse(response.text) as { seed?: string };
    return Boolean(payload.seed);
  } catch {
    return false;
  }
};

const discoverWingsApiOnce = async (
  tmdbId: number,
): Promise<WingsApiRuntime | null> => {
  const videasyPage = await findFirstPlayerPage(
    defaultWingsPlayerOriginCandidates("videasy"),
  );
  const vidkingPage = await findFirstPlayerPage(
    defaultWingsPlayerOriginCandidates("vidking"),
  );

  const pages = [videasyPage, vidkingPage].filter(
    (page): page is NonNullable<typeof page> => Boolean(page),
  );
  if (pages.length === 0) {
    return null;
  }

  const extraOrigins = unique(
    pages.flatMap((page) => extractPlayerOriginsFromSource(page.blob)),
  );
  for (const origin of extraOrigins.slice(0, 4)) {
    const already =
      videasyPage?.origin === origin || vidkingPage?.origin === origin;
    if (already) {
      continue;
    }
    const extra = await collectFromPlayer(origin);
    if (extra) {
      pages.push(extra);
    }
  }

  let videasyOrigin = videasyPage?.origin ?? getVideasyPlayerOrigin();
  let vidkingOrigin = vidkingPage?.origin ?? getVidkingPlayerOrigin();
  let apiBase: string | null = null;

  for (const page of pages) {
    for (const candidate of page.apiBases) {
      if (await probeSeed(candidate, page.origin, tmdbId)) {
        apiBase = candidate;
        if (page.origin.includes("videasy")) {
          videasyOrigin = page.origin;
        }
        if (page.origin.includes("vidking")) {
          vidkingOrigin = page.origin;
        }
        break;
      }
    }
    if (apiBase) {
      break;
    }
  }

  if (!apiBase) {
    return null;
  }

  if (
    videasyPage &&
    videasyOrigin !== videasyPage.origin &&
    (await probeSeed(apiBase, videasyPage.origin, tmdbId))
  ) {
    videasyOrigin = videasyPage.origin;
  }

  if (
    vidkingPage &&
    vidkingOrigin !== vidkingPage.origin &&
    (await probeSeed(apiBase, vidkingPage.origin, tmdbId))
  ) {
    vidkingOrigin = vidkingPage.origin;
  }

  const next: WingsApiRuntime = {
    apiBase,
    videasyPlayerOrigin: videasyOrigin,
    vidkingPlayerOrigin: vidkingOrigin,
    discoveredAt: Date.now(),
  };
  setWingsApiRuntime(next);
  return next;
};

export const discoverWingsApi = async (
  tmdbId = 550,
  options: { force?: boolean } = {},
): Promise<WingsApiRuntime | null> => {
  const cached = getWingsApiRuntime();
  if (
    !options.force &&
    cached &&
    Date.now() - cached.discoveredAt < WINGS_DISCOVER_TTL_MS
  ) {
    return cached;
  }

  if (inflight) {
    return inflight;
  }

  if (
    !options.force &&
    lastFailAt > 0 &&
    Date.now() - lastFailAt < WINGS_DISCOVER_FAIL_COOLDOWN_MS
  ) {
    return cached;
  }

  inflight = discoverWingsApiOnce(tmdbId)
    .then((result) => {
      lastFailAt = result ? 0 : Date.now();
      return result;
    })
    .finally(() => {
      inflight = undefined;
    });

  return inflight;
};

const readSeed = async (
  origin: string,
  tmdbId: number,
): Promise<WingsSeedResult> => {
  try {
    const response = await scrapeFetch(wingsSeedUrl(tmdbId), {
      headers: wingsApiHeaders(origin),
      timeoutMs: 8_000,
      retryAttempts: 1,
    });
    if (!response.ok) {
      await cancelResponseBody(response);
      return {
        ok: false,
        error: `Seed request failed (${response.status})`,
        status: response.status,
      };
    }
    const payload = (await response.json()) as { seed?: string };
    if (!payload.seed) {
      return { ok: false, error: "Missing seed", status: response.status };
    }
    return { ok: true, seed: payload.seed, origin };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Seed request failed",
      network: true,
    };
  }
};

export const fetchWingsSeed = async (
  player: WingsPlayerKind,
  tmdbId: number,
): Promise<WingsSeedResult> => {
  const firstOrigin = playerOriginFor(player);
  const first = await readSeed(firstOrigin, tmdbId);
  if (first.ok) {
    return first;
  }

  if (!first.network) {
    for (const origin of defaultWingsPlayerOriginCandidates(player).slice(
      0,
      6,
    )) {
      if (origin === firstOrigin) {
        continue;
      }
      const result = await readSeed(origin, tmdbId);
      if (result.ok) {
        persistPlayerOrigin(player, origin);
        return result;
      }
    }
  }

  const discovered = await discoverWingsApi(tmdbId, { force: true });
  if (!discovered) {
    return first;
  }

  return readSeed(playerOriginFor(player), tmdbId);
};
