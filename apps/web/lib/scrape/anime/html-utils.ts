import type { ScrapeSubtitle } from "../types";

/** Decode common HTML entity encodings in scraped markup. */
export const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");

export const extractFirstMatch = (
  html: string,
  pattern: RegExp,
): string | null => {
  const match = html.match(pattern);
  return match?.[1] ?? null;
};

/** True for real media paths — not hostnames like mp4upload.com. */
export const isDirectMediaUrl = (url: string): boolean => {
  try {
    const { pathname } = new URL(url);
    return /\.(?:m3u8|mpd|mp4)$/i.test(pathname);
  } catch {
    return /\.(?:m3u8|mpd|mp4)(?:[?#]|$)/i.test(url);
  }
};

const NON_CAPTION_TRACK_PATTERN =
  /\b(?:chapters|storyboard|thumbnails?|sprites?)\b/i;

const subtitleFormatFromUrl = (
  url: string,
): NonNullable<ScrapeSubtitle["format"]> => {
  if (/\.ass(?:[?#]|$)/i.test(url)) {
    return "ass";
  }
  if (/\.srt(?:[?#]|$)/i.test(url)) {
    return "srt";
  }
  return "vtt";
};

const readHtmlAttr = (attrs: string, name: string): string | null => {
  const quoted = attrs.match(
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"),
  )?.[1];
  if (quoted) {
    return quoted;
  }

  return (
    attrs.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, "i"))?.[1] ?? null
  );
};

/**
 * Extract softsub tracks from HTML (`<track>` tags and bare caption URLs).
 */
export const extractHtmlSubtitleTracks = (html: string): ScrapeSubtitle[] => {
  const decoded = decodeHtmlEntities(html);
  const tracks: ScrapeSubtitle[] = [];
  const seen = new Set<string>();

  const pushTrack = (url: string, lang: string) => {
    if (!url.startsWith("http") || seen.has(url)) {
      return;
    }
    if (NON_CAPTION_TRACK_PATTERN.test(url)) {
      return;
    }
    seen.add(url);
    tracks.push({
      lang: lang.trim() || "Unknown",
      url,
      format: subtitleFormatFromUrl(url),
    });
  };

  for (const match of decoded.matchAll(/<track\b([^>]*)>/gi)) {
    const attrs = match[1] ?? "";
    const kind = readHtmlAttr(attrs, "kind")?.toLowerCase();
    if (kind && kind !== "subtitles" && kind !== "captions") {
      continue;
    }

    const src = readHtmlAttr(attrs, "src");
    if (!src) {
      continue;
    }

    const label =
      readHtmlAttr(attrs, "label") ??
      readHtmlAttr(attrs, "srclang") ??
      "Unknown";
    pushTrack(src, label);
  }

  for (const match of decoded.matchAll(
    /https?:\/\/[^"'\\\s<>]+?\.(?:ass|srt|vtt)(?:\?[^"'\\\s<>]*)?/gi,
  )) {
    const url = match[0].replace(/\\\//g, "/");
    if (seen.has(url)) {
      continue;
    }

    const fileName = url.split("/").pop()?.split("?")[0] ?? "";
    const langGuess =
      fileName.match(/^(\d+_)?([a-z]{2,3})(?:[-_]|$)/i)?.[2] ?? "Unknown";
    pushTrack(url, langGuess);
  }

  return tracks;
};

export const extractM3u8Urls = (html: string): string[] => {
  const decoded = decodeHtmlEntities(html);
  const matches = decoded.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi);
  return [...new Set(matches ?? [])];
};

export const extractJsonPreBody = (html: string): string | null => {
  const match = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (!match?.[1]) {
    return null;
  }

  return decodeHtmlEntities(match[1].trim());
};

export type CatPlayerProps = {
  manifest?: string;
  subtitles?: Array<{
    lang: string;
    name?: string;
    src: string;
  }>;
};

/** Unwrap KickAssAnime / React flight `[tag, value]` tuples. */
const unwrapCatPlayerValue = (value: unknown): unknown => {
  let current = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!Array.isArray(current) || current.length < 2) {
      break;
    }
    if (typeof current[0] !== "number") {
      break;
    }
    current = current[1];
  }
  return current;
};

const extractCatPlayerSubtitles = (
  rawSubtitles: unknown,
): CatPlayerProps["subtitles"] => {
  const list = unwrapCatPlayerValue(rawSubtitles);
  if (!Array.isArray(list)) {
    return undefined;
  }

  const subtitles: NonNullable<CatPlayerProps["subtitles"]> = [];
  for (const entry of list) {
    const item = unwrapCatPlayerValue(entry);
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const lang = unwrapCatPlayerValue(record.language);
    const name = unwrapCatPlayerValue(record.name);
    const src = unwrapCatPlayerValue(record.src);
    if (typeof lang !== "string" || typeof src !== "string") {
      continue;
    }
    if (!src.startsWith("http")) {
      continue;
    }

    subtitles.push({
      lang,
      name: typeof name === "string" ? name : undefined,
      src,
    });
  }

  return subtitles.length > 0 ? subtitles : undefined;
};

/** Parse KickAssAnime cat-player `props="..."` attribute (React flight tuple). */
export const parseCatPlayerProps = (html: string): CatPlayerProps | null => {
  const rawJson = extractFirstMatch(html, /(?:props|data-props)="([^"]+)"/);
  const decoded = decodeHtmlEntities(rawJson ?? "");

  if (decoded) {
    try {
      const parsed = JSON.parse(decoded) as Record<string, unknown>;

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const manifestValue = unwrapCatPlayerValue(parsed.manifest);
        const manifest =
          typeof manifestValue === "string" ? manifestValue : undefined;
        const subtitles = extractCatPlayerSubtitles(parsed.subtitles);

        if (manifest || subtitles) {
          return {
            ...(manifest ? { manifest } : {}),
            ...(subtitles ? { subtitles } : {}),
          };
        }
      }

      if (Array.isArray(parsed)) {
        const manifestIndex =
          typeof parsed[1] === "number" ? parsed[1] : undefined;
        const manifestUrl =
          manifestIndex !== undefined &&
          typeof parsed[manifestIndex] === "string"
            ? parsed[manifestIndex]
            : null;

        return manifestUrl ? { manifest: manifestUrl } : null;
      }
    } catch {
      void 0;
    }
  }

  const manifestUrl =
    extractFirstMatch(html, /(https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*)/) ??
    extractFirstMatch(html, /https?:\\\/\\\/[^"\\]+\.m3u8/)?.replace(
      /\\\//g,
      "/",
    ) ??
    extractFirstMatch(html, /source\s+src\s*=\s*["']([^"']+\.m3u8[^"']*)["']/i);

  return manifestUrl ? { manifest: manifestUrl } : null;
};

export const decodeBase64Loose = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(
    `${normalized}${"=".repeat(padLength)}`,
    "base64",
  ).toString("utf8");
};

export const extractDataUrlAttributes = (html: string): string[] => {
  const matches = html.match(/data-url="([^"]+)"/g) ?? [];
  return matches
    .map((entry) => extractFirstMatch(entry, /data-url="([^"]+)"/))
    .filter((entry): entry is string => Boolean(entry));
};

const DEAN_EDWARDS_PACKER_PATTERN =
  /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:\\.|[^'])*)',(\d+),(\d+),'((?:\\.|[^'])*)'\.split\('\|'\)/g;

const encodePackerToken = (value: number, radix: number): string => {
  const alphabet =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (value < radix) {
    return alphabet[value] ?? "";
  }

  return `${encodePackerToken(Math.floor(value / radix), radix)}${
    alphabet[value % radix] ?? ""
  }`;
};

const decodePackedString = (value: string): string =>
  value
    .replace(/\\'/g, "'")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\");

/** Unpack Dean Edwards P.A.C.K.E.R scripts without evaluating remote code. */
export const unpackDeanEdwardsScripts = (html: string): string[] =>
  [...html.matchAll(DEAN_EDWARDS_PACKER_PATTERN)].map((match) => {
    const payload = decodePackedString(match[1] ?? "");
    const radix = Number(match[2]);
    const count = Number(match[3]);
    const symbols = (match[4] ?? "").split("|");
    let unpacked = payload;

    for (let index = count - 1; index >= 0; index -= 1) {
      const symbol = symbols[index];
      if (!symbol) continue;
      const token = encodePackerToken(index, radix);
      unpacked = unpacked.replace(new RegExp(`\\b${token}\\b`, "g"), symbol);
    }

    return unpacked;
  });
