import {
  fetchMovieCertification,
  fetchTVShowCertification,
} from "@/app/actions";
import { MediaItem, MovieSchema, TvShowSchema } from "@/utils/typings";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { items } = await request.json();

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Items array is required" },
        { status: 400 },
      );
    }

    const ratings: Record<number, string | null> = {};
    const processedIds = new Set<number>();

    // Create promises for fetching ratings
    const ratingPromises = items.map(async (item: MediaItem) => {
      // Ensure item has an id property
      if (!item.id || processedIds.has(item.id)) return;

      processedIds.add(item.id);

      try {
        let rating: string | null = null;

        // Use Zod to safely parse and determine type
        const movieResult = MovieSchema.safeParse(item);
        const tvShowResult = TvShowSchema.safeParse(item);

        if (movieResult.success) {
          rating = await fetchMovieCertification(movieResult.data.id);
        } else if (tvShowResult.success) {
          rating = await fetchTVShowCertification(tvShowResult.data.id);
        }

        if (rating) {
          ratings[item.id] = rating;
        }
      } catch (error) {
        console.error(`Error fetching rating for item ${item.id}:`, error);
      }
    });

    // Wait for all rating fetches to complete
    await Promise.all(ratingPromises);

    return NextResponse.json({ ratings });
  } catch (error) {
    console.error("Error fetching content ratings:", error);
    return NextResponse.json(
      { error: "Failed to fetch content ratings" },
      { status: 500 },
    );
  }
}
