const CAP_PROTECTED_PREFIXES = [
  "/api/search",
  "/api/search-preview",
  "/api/trailers/",
  "/api/media/",
  "/api/movies",
  "/api/tv/",
  "/api/genres",
  "/api/genre/",
  "/api/country/",
  "/api/map",
  "/api/introdb/",
  "/api/anime/",
  "/api/person-search",
  "/api/live/channels",
  "/api/direct/session",
  "/api/scrape",
  "/api/servers/health",
] as const;

export const isCapProtectedApiPath = (pathname: string): boolean =>
  CAP_PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
