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
  manifest?: unknown;
  subtitles?: unknown;
};

/** Parse KickAssAnime cat-player `props="..."` attribute (React flight tuple). */
export const parseCatPlayerProps = (html: string): CatPlayerProps | null => {
  const rawJson = extractFirstMatch(html, /(?:props|data-props)="([^"]+)"/);
  const decoded = decodeHtmlEntities(rawJson ?? "");

  if (decoded) {
    try {
      const parsed = JSON.parse(decoded) as Record<string, unknown>;

      const manifestField = parsed.manifest;
      if (Array.isArray(manifestField)) {
        const manifestUrl = manifestField.find(
          (entry): entry is string => typeof entry === "string",
        );
        if (manifestUrl) {
          return { manifest: manifestUrl };
        }
      }

      if (typeof parsed.manifest === "string") {
        return { manifest: parsed.manifest };
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
      // fall through to regex extraction
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
