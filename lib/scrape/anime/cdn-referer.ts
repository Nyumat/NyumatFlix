/** CDN embed roots that segment probes need when the API returns a player referer. */
import {
  isJustanimeMomoProxyUrl,
  JUSTANIME_ORIGIN,
} from "../justanime-momo-proxy";

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
  if (streamUrl.includes("mewstream") || streamUrl.includes("megaplay")) {
    return "https://megaplay.buzz/";
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
  if (/megaplay|mewstream/i.test(streamUrl)) {
    push("https://megaplay.buzz/");
  }
};
