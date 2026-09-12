export const isPlaceholderEpisodeName = (name: string): boolean => {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return /^(episode|ep)\.?\s*\d+(\.\d+)?$/i.test(trimmed);
};

export const resolveEpisodeThumbnailUrl = (input: {
  stillPath: string | null | undefined;
  kitsuUrl?: string | null;
  fallbackPosterPath?: string | null;
  fallbackBackdropPath?: string | null;
  tmdbImageUrl: (path: string, size: string) => string;
}): string | null => {
  const stillPath = input.stillPath?.trim() || null;
  const posterPath = input.fallbackPosterPath?.trim() || null;
  const backdropPath = input.fallbackBackdropPath?.trim() || null;
  const stillIsSeriesArt =
    Boolean(stillPath) &&
    (stillPath === posterPath || stillPath === backdropPath);

  if (stillPath && !stillIsSeriesArt) {
    return input.tmdbImageUrl(stillPath, "w300");
  }

  if (input.kitsuUrl) {
    return input.kitsuUrl;
  }

  if (posterPath) {
    return input.tmdbImageUrl(posterPath, "w342");
  }

  return null;
};
