/** CDN embed roots that segment probes need when the API returns a player referer. */
import { isOkCdnHlsUrl } from "./allanime-stream-url";
import {
  isJustanimeMomoProxyUrl,
  JUSTANIME_ORIGIN,
} from "../justanime-momo-proxy";

const ALLMANGA_ORIGIN = "https://allmanga.to/";
const ALLANIME_ORIGIN = "https://allanime.day/";

export const preferAnimeCdnReferer = (
  streamUrl: string,
  headersReferer?: string,
  fallbackReferer?: string,
): string => {
  if (isJustanimeMomoProxyUrl(streamUrl)) {
    return `${JUSTANIME_ORIGIN}/`;
  }
  if (streamUrl.includes("vivibebe.site")) {
    return "https://vivibebe.site/";
  }
  if (
    streamUrl.includes("mewstream") ||
    streamUrl.includes("megaplay") ||
    streamUrl.includes("kotocdn.site")
  ) {
    return "https://megaplay.buzz/";
  }
  if (isOkCdnHlsUrl(streamUrl)) {
    return ALLMANGA_ORIGIN;
  }
  if (headersReferer) {
    return headersReferer;
  }
  return fallbackReferer ?? streamUrl;
};

export const appendAnimeCdnReferers = (
  streamUrl: string,
  referers: string[],
  seen: Set<string>,
): void => {
  const push = (value: string) => {
    if (seen.has(value)) return;
    seen.add(value);
    referers.push(value);
  };

  if (/vivibebe\.site/i.test(streamUrl)) {
    push("https://vivibebe.site/");
  }
  if (/megaplay|mewstream|kotocdn\.site/i.test(streamUrl)) {
    push("https://megaplay.buzz/");
  }
  if (isOkCdnHlsUrl(streamUrl)) {
    push(ALLMANGA_ORIGIN);
    push(ALLANIME_ORIGIN);
    push("https://ok.ru/");
    try {
      push(new URL(streamUrl).origin + "/");
    } catch {
      void 0;
    }
  }
};
