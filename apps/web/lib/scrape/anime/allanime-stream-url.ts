/** AllAnime clock.json links sometimes ship double-escaped `\\u0026` query separators. */
export const normalizeAllanimeStreamUrl = (url: string): string =>
  url
    .replaceAll("\\\\u0026", "&")
    .replaceAll("\\u0026", "&")
    .replaceAll("\\\\u003d", "=")
    .replaceAll("\\u003d", "=")
    .replace(/\\+$/g, "");

export const isOkCdnHlsUrl = (url: string): boolean => /okcdn\.ru/i.test(url);
