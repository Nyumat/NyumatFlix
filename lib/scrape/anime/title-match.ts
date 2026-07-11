const TITLE_SEPARATOR = /[^\p{L}\p{N}]+/gu;

export const normalizeAnimeTitle = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(TITLE_SEPARATOR, " ")
    .trim()
    .replace(/\s+/g, " ");

export const isExactAnimeTitleMatch = (
  candidate: string,
  expectedTitles: readonly string[],
): boolean => {
  const normalizedCandidate = normalizeAnimeTitle(candidate);
  if (!normalizedCandidate) return false;

  return expectedTitles.some(
    (title) => normalizeAnimeTitle(title) === normalizedCandidate,
  );
};
