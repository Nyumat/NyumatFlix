import type { SeasonDetails } from "@/lib/domain/typings";

export async function fetchSeasonDetails(
  tvId: string,
  seasonNumber: number,
): Promise<SeasonDetails | null> {
  try {
    const response = await fetch(`/api/tv/${tvId}/season/${seasonNumber}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch season details: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}
