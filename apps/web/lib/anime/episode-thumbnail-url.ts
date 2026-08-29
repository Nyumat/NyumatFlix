export const resolveEpisodeThumbnailUrl = (input: {
  stillPath: string | null | undefined;
  kitsuUrl?: string | null;
  fallbackPosterPath?: string | null;
  tmdbImageUrl: (path: string, size: string) => string;
}): string | null => {
  if (input.stillPath) {
    return input.tmdbImageUrl(input.stillPath, "w300");
  }

  if (input.kitsuUrl) {
    return input.kitsuUrl;
  }

  if (input.fallbackPosterPath) {
    return input.tmdbImageUrl(input.fallbackPosterPath, "w342");
  }

  return null;
};
