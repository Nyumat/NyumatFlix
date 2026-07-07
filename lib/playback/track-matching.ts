export type TrackLanguageFields = {
  language?: string | null;
  label?: string | null;
  lang?: string | null;
};

export const normalizeTrackLanguage = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

export const trackMatchesLanguage = (
  track: TrackLanguageFields,
  preferred: string,
): boolean => {
  const normalizedPreferred = normalizeTrackLanguage(preferred);
  if (!normalizedPreferred) {
    return false;
  }

  const candidates = [track.language, track.label, track.lang].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeTrackLanguage(candidate);
    if (!normalizedCandidate) {
      return false;
    }

    return (
      normalizedCandidate === normalizedPreferred ||
      normalizedCandidate.includes(normalizedPreferred) ||
      normalizedPreferred.includes(normalizedCandidate)
    );
  });
};

export const pickTrackIndexByLanguage = <T extends TrackLanguageFields>(
  tracks: readonly T[],
  preferred: string | null | undefined,
): number | null => {
  if (!preferred) {
    return null;
  }

  const index = tracks.findIndex((track) =>
    trackMatchesLanguage(track, preferred),
  );
  return index >= 0 ? index : null;
};
