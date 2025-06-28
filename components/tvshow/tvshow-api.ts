import { SeasonDetails, TvShowDetails } from "@/utils/typings";

/**
 * Fetches details for a TV show by ID
 */
export async function fetchTVShowDetails(id: string): Promise<TvShowDetails> {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US&append_to_response=videos,images,credits,recommendations,similar,keywords,reviews,content_ratings,aggregate_credits,images`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch TV show details: ${response.status}`);
    }
    const data = await response.json();

    // Enrich TV show data with logos
    const { fetchAndEnrichMediaItems } = await import("@/app/actions");
    const enrichedData = await fetchAndEnrichMediaItems([data], "tv");

    return enrichedData[0];
  } catch (error) {
    console.error(error);
    throw new Error("Failed to fetch TV show details");
  }
}

/**
 * Fetches details for a specific season of a TV show
 */
export async function fetchSeasonDetails(
  tvId: string,
  seasonNumber: number,
): Promise<SeasonDetails | null> {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch season details: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}
