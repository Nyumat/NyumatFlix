import type { VidsrcApi } from "@/lib/providers/embed-urls";
import type { ServerAvailabilityInput } from "@/lib/stores/embed-server-store";

export function buildServerAvailabilityKey(
  input: ServerAvailabilityInput,
  vidsrcApi: VidsrcApi,
): string {
  return [
    input.mediaType,
    input.tmdbId,
    input.seasonNumber ?? "",
    input.episodeNumber ?? "",
    input.anilistId ?? "",
    input.animeEpisodeNumber ?? "",
    input.animePreference ?? "",
    vidsrcApi,
  ].join(":");
}
