import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserWatchlist } from "./actions";
import { WatchlistClient } from "./watchlist-client";
import { Metadata } from "next";
import { fetchAndEnrichMediaItems } from "../actions";
import { MediaItem } from "@/utils/typings";

export const metadata: Metadata = {
  title: "My Watchlist | NyumatFlix",
  description: "Manage your watchlist and track your viewing progress",
};

export default async function WatchlistPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const watchlistItems = await getUserWatchlist();

  // Fetch media details for each watchlist item
  const mediaItems = await Promise.all(
    watchlistItems.map(async (item) => {
      try {
        const url =
          item.mediaType === "movie"
            ? `https://api.themoviedb.org/3/movie/${item.contentId}?api_key=${process.env.TMDB_API_KEY}&language=en-US`
            : `https://api.themoviedb.org/3/tv/${item.contentId}?api_key=${process.env.TMDB_API_KEY}&language=en-US`;

        const response = await fetch(url, { next: { revalidate: 3600 } });
        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return {
          ...data,
          media_type: item.mediaType,
          watchlistItem: item,
        };
      } catch (error) {
        console.error(
          `Error fetching ${item.mediaType} ${item.contentId}:`,
          error,
        );
        return null;
      }
    }),
  );

  // Filter out null values and separate by type
  const validRawItems = mediaItems.filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );

  // Separate movies and TV shows
  const movies = validRawItems.filter((item) => item.media_type === "movie");
  const tvShows = validRawItems.filter((item) => item.media_type === "tv");

  // Enrich media items by type
  const enrichedMovies =
    movies.length > 0 ? await fetchAndEnrichMediaItems(movies, "movie") : [];
  const enrichedTvShows =
    tvShows.length > 0 ? await fetchAndEnrichMediaItems(tvShows, "tv") : [];

  // Combine enriched items
  const enrichedItems = [...enrichedMovies, ...enrichedTvShows];

  // Create a map for quick lookup
  const watchlistMap = new Map(
    watchlistItems.map((item) => [item.contentId, item]),
  );

  // Combine enriched items with watchlist data
  const itemsWithWatchlist = enrichedItems.map((item) => {
    const watchlistItem = watchlistMap.get(item.id);
    return {
      ...item,
      media_type: watchlistItem?.mediaType || item.media_type || "movie",
      watchlistItem: watchlistItem!,
    };
  });

  // Group by status
  const watchingItems = itemsWithWatchlist.filter(
    (item) => item.watchlistItem?.status === "watching",
  );
  const waitingItems = itemsWithWatchlist.filter(
    (item) => item.watchlistItem?.status === "waiting",
  );
  const finishedItems = itemsWithWatchlist.filter(
    (item) => item.watchlistItem?.status === "finished",
  );

  return (
    <WatchlistClient
      watchingItems={watchingItems}
      waitingItems={waitingItems}
      finishedItems={finishedItems}
      watchlistItems={watchlistItems}
    />
  );
}
