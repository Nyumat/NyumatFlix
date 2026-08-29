import { decodeHtmlEntities } from "./html-utils";
import { cancelResponseBody, scrapeFetch } from "../fetch";
import {
  SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
} from "../playback-probe";
import { isExactAnimeTitleMatch } from "./title-match";

type LivewireUpdateResponse = {
  components?: Array<{
    effects?: {
      html?: string;
    };
  }>;
};

export type AnizoneSearchItem = {
  slug: string;
  main_title: string;
  title_list?: Record<string, string>;
  type?: string;
};

const extractAnimeIndexSnapshot = (pageHtml: string): string | null => {
  const match = pageHtml.match(
    /wire:snapshot="(\{&quot;data&quot;:\{&quot;title&quot;:&quot;Anime Index&quot;[\s\S]*?\})" wire:effects/,
  );

  if (!match?.[1]) {
    return null;
  }

  return decodeHtmlEntities(match[1].replace(/&quot;/g, '"'));
};

const extractCsrfToken = (pageHtml: string): string | null =>
  pageHtml.match(/name="csrf-token" content="([^"]+)"/)?.[1] ?? null;

const parseSetCookieHeader = (header: string): string =>
  header
    .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");

const decodeAnizoneJsEscape = (escaped: string): string => {
  switch (escaped) {
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "/":
      return "/";
    case "\\":
      return "\\";
    case "'":
      return "'";
    case '"':
      return '"';
    default:
      return escaped;
  }
};

const decodeAnizoneJsString = (raw: string): string => {
  let decoded = "";
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char !== "\\") {
      decoded += char;
      continue;
    }

    const next = raw[index + 1];
    if (!next) {
      break;
    }

    if (next === "u") {
      const hex = raw.slice(index + 2, index + 6);
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        decoded += String.fromCharCode(Number.parseInt(hex, 16));
        index += 5;
        continue;
      }
    }

    decoded += decodeAnizoneJsEscape(next);
    index += 1;
  }
  return decoded;
};

const parseAnizoneEmbeddedJson = (encoded: string): unknown =>
  JSON.parse(decodeAnizoneJsString(encoded));

const extractAnizoneJsonParseArgument = (
  html: string,
  pattern: RegExp,
): string | null => {
  const match = html.match(pattern);
  return match?.[2] ?? null;
};

const isAnizoneSearchItem = (value: unknown): value is AnizoneSearchItem => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.slug === "string" && typeof record.main_title === "string"
  );
};

/** Alpine `items: JSON.parse('...')` — slugs are escaped as `anime\/slug`, not `/anime/`. */
export const extractAnizoneSearchItems = (
  html: string,
): AnizoneSearchItem[] => {
  const encoded = extractAnizoneJsonParseArgument(
    html,
    /items:\s*JSON\.parse\((['"])((?:\\.|[^\\])*?)\1\)/,
  );
  if (!encoded) {
    return [];
  }

  try {
    const parsed = parseAnizoneEmbeddedJson(encoded);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isAnizoneSearchItem);
  } catch {
    return [];
  }
};

export type AnizoneVidstackSubtitle = {
  title?: string;
  format?: string;
  language?: string;
  file?: string;
};

export type AnizoneVidstackPlayer = {
  src: string;
  subtitles: AnizoneVidstackSubtitle[];
};

const isAnizoneVidstackSubtitle = (
  value: unknown,
): value is AnizoneVidstackSubtitle => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.file === "string" || typeof record.title === "string";
};

/** Vidstack config is Alpine `vidstackPlayer(JSON.parse('...'))` with `\u0022` escapes. */
export const extractAnizoneVidstackPlayer = (
  html: string,
): AnizoneVidstackPlayer | null => {
  const encoded = extractAnizoneJsonParseArgument(
    html,
    /vidstackPlayer\(JSON\.parse\((['"])((?:\\.|[^\\])*?)\1\)/,
  );
  if (!encoded) {
    return null;
  }

  try {
    const parsed = parseAnizoneEmbeddedJson(encoded);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.src !== "string" || record.src.length === 0) {
      return null;
    }
    const subtitles = Array.isArray(record.subtitles)
      ? record.subtitles.filter(isAnizoneVidstackSubtitle)
      : [];
    return { src: record.src.replace(/\\\//g, "/"), subtitles };
  } catch {
    return null;
  }
};

const anizoneItemTitles = (item: AnizoneSearchItem): string[] => [
  item.main_title,
  ...Object.values(item.title_list ?? {}),
];

export const pickAnizoneSlugFromItems = (
  items: readonly AnizoneSearchItem[],
  query: string,
): string | null => {
  const exact = items.filter((item) =>
    anizoneItemTitles(item).some((title) =>
      isExactAnimeTitleMatch(title, [query]),
    ),
  );
  if (exact.length === 0) {
    return null;
  }

  const tvSeries = exact.filter((item) => item.type === "TV Series");
  const pool = tvSeries.length > 0 ? tvSeries : exact;
  return pool[0]?.slug ?? null;
};

/** AniZone search is Livewire-only — query params do not SSR results. */
type AnizoneSearchSession = {
  csrf: string;
  snapshot: string;
  cookieHeader: string;
};

const anizoneFetchOptions = {
  timeoutMs: SCRAPE_PLAY_PROBE_TIMEOUT_MS,
  retryAttempts: SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
};

const loadAnizoneSearchSession =
  async (): Promise<AnizoneSearchSession | null> => {
    const indexResponse = await scrapeFetch("https://anizone.to/anime", {
      headers: { Referer: "https://anizone.to/" },
      ...anizoneFetchOptions,
    });

    if (!indexResponse.ok) {
      await cancelResponseBody(indexResponse);
      return null;
    }

    const indexHtml = await indexResponse.text();
    const csrf = extractCsrfToken(indexHtml);
    const snapshot = extractAnimeIndexSnapshot(indexHtml);
    const cookieHeader = parseSetCookieHeader(
      indexResponse.headers.get("set-cookie") ?? "",
    );

    if (!csrf || !snapshot) {
      return null;
    }

    return { csrf, snapshot, cookieHeader };
  };

const queryAnizoneSlug = async (
  session: AnizoneSearchSession,
  query: string,
): Promise<string | null> => {
  const payload = {
    _token: session.csrf,
    components: [
      {
        snapshot: session.snapshot,
        updates: { search: query },
        calls: [],
      },
    ],
  };

  const response = await scrapeFetch("https://anizone.to/livewire/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Livewire": "true",
      "X-CSRF-TOKEN": session.csrf,
      Referer: "https://anizone.to/anime",
      Origin: "https://anizone.to",
      ...(session.cookieHeader ? { Cookie: session.cookieHeader } : {}),
    },
    body: JSON.stringify(payload),
    ...anizoneFetchOptions,
  });

  if (!response.ok) {
    await cancelResponseBody(response);
    return null;
  }

  const livewire = (await response.json()) as LivewireUpdateResponse;
  const html = livewire.components?.[0]?.effects?.html ?? "";
  return pickAnizoneSlugFromItems(extractAnizoneSearchItems(html), query);
};

export const searchAnizoneSlug = async (
  query: string,
): Promise<string | null> => {
  const session = await loadAnizoneSearchSession();
  if (!session) {
    return null;
  }
  return queryAnizoneSlug(session, query);
};

export const searchAnizoneSlugFromQueries = async (
  queries: readonly string[],
): Promise<string | null> => {
  const session = await loadAnizoneSearchSession();
  if (!session) {
    return null;
  }

  for (const query of queries) {
    const slug = await queryAnizoneSlug(session, query);
    if (slug) {
      return slug;
    }
  }

  return null;
};
