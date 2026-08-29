export const isMovieDiscoverEndpoint = (endpoint: string): boolean =>
  endpoint.replace(/\/+$/, "").endsWith("discover/movie");

export const defaultMovieDiscoverIncludeVideo = (
  includeVideo: boolean | string | undefined,
): string => {
  if (includeVideo === undefined) return "true";
  return String(includeVideo);
};

export const withMovieDiscoverIncludeVideo = (
  params: Record<string, string>,
): Record<string, string> => ({
  include_video: "true",
  ...params,
});
