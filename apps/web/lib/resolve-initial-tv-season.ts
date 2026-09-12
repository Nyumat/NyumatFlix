import type { TvShowDetails } from "@/lib/domain/typings";

export function resolveInitialTvSeasonNumber(
  details: TvShowDetails,
  requestedSeason?: number | null,
): number {
  const seasonNumbers = (details.seasons ?? [])
    .map((season) => season.season_number)
    .filter((seasonNumber) => seasonNumber > 0)
    .sort((left, right) => left - right);

  if (requestedSeason && seasonNumbers.includes(requestedSeason)) {
    return requestedSeason;
  }

  return seasonNumbers[0] ?? 1;
}
