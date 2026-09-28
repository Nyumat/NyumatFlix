import type { HeroBackdropCandidate } from "@/lib/flags/hero-backdrop-candidates";

const normalizeTitle = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const yearsAreCompatible = (
  left: string | null,
  right: string | null,
): boolean => {
  if (!left || !right) return true;
  const delta = Math.abs(
    Number.parseInt(left, 10) - Number.parseInt(right, 10),
  );
  return !Number.isFinite(delta) || delta <= 1;
};

const titlesAreSameWork = (
  leftTitle: string,
  leftYear: string | null,
  rightTitle: string,
  rightYear: string | null,
): boolean => {
  const left = normalizeTitle(leftTitle);
  const right = normalizeTitle(rightTitle);
  if (!left || !right || left !== right) return false;
  return yearsAreCompatible(leftYear, rightYear);
};

const cloneCandidate = (
  candidate: HeroBackdropCandidate,
): HeroBackdropCandidate => ({
  ...candidate,
  backdrops: [...candidate.backdrops],
});

export const mergeHeroBackdropCandidates = (
  tmdbCandidates: readonly HeroBackdropCandidate[],
  animeCandidates: readonly HeroBackdropCandidate[],
): HeroBackdropCandidate[] => {
  const merged = tmdbCandidates.map(cloneCandidate);
  const claimed = new Set<HeroBackdropCandidate>();

  for (const anime of animeCandidates) {
    const match = merged.find(
      (candidate) =>
        !claimed.has(candidate) &&
        titlesAreSameWork(
          candidate.title,
          candidate.year,
          anime.title,
          anime.year,
        ),
    );

    if (!match) {
      merged.push(cloneCandidate(anime));
      continue;
    }

    claimed.add(match);
    match.anilistId = anime.anilistId;
    match.malId = anime.malId;
    match.subtitle = "TMDB + AniList";
    for (const backdrop of anime.backdrops) {
      if (!match.backdrops.some((option) => option.path === backdrop.path)) {
        match.backdrops.push(backdrop);
      }
    }
  }

  return merged;
};
