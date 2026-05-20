import { auth } from "@/auth";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { MediaItemSchema, type MediaItem } from "@/utils/typings";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { fetchAndEnrichMediaItems } from "../actions";
import { getUserWatchlist, type WatchlistItem } from "./actions";
import { WatchlistClient } from "./watchlist-client";

export const metadata: Metadata = {
  title: "My Watchlist | NyumatFlix",
  description: "Manage your watchlist and track your viewing progress",
};

type WatchlistMediaResponse = MediaItem & {
  media_type: "movie" | "tv";
  watchlistItem: WatchlistItem;
};

type TmdbDetailGenre = {
  id: number;
  name?: string;
};

function getWatchlistKey(item: Pick<WatchlistItem, "contentId" | "mediaType">) {
  return `${item.mediaType}:${item.contentId}`;
}

function normalizeTmdbDetailForWatchlist(
  data: unknown,
  item: WatchlistItem,
): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  const detail = data as {
    genres?: TmdbDetailGenre[];
    genre_ids?: number[];
    media_type?: "movie" | "tv";
  };

  return {
    ...detail,
    media_type: item.mediaType,
    genre_ids:
      detail.genre_ids ??
      detail.genres
        ?.map((genre) => genre.id)
        .filter((id): id is number => typeof id === "number") ??
      [],
  };
}

export default async function WatchlistPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const watchlistItems = await getUserWatchlist();

  // Fetch media details for each watchlist item in batches
  const BATCH_SIZE = 10;
  const mediaItems: Array<WatchlistMediaResponse | null> = [];

  for (let i = 0; i < watchlistItems.length; i += BATCH_SIZE) {
    const batch = watchlistItems.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const url =
            item.mediaType === "movie"
              ? `https://api.themoviedb.org/3/movie/${item.contentId}?api_key=${process.env.TMDB_API_KEY}&language=en-US`
              : `https://api.themoviedb.org/3/tv/${item.contentId}?api_key=${process.env.TMDB_API_KEY}&language=en-US`;

          const response = await fetch(url, { next: { revalidate: 3600 } });
          if (!response.ok) {
            return null;
          }

          const data = normalizeTmdbDetailForWatchlist(
            await response.json(),
            item,
          );
          const parsed = MediaItemSchema.safeParse(data);
          if (!parsed.success) {
            console.error(
              `Invalid watchlist media payload for ${item.mediaType} ${item.contentId}:`,
              parsed.error.message,
            );
            return null;
          }

          return {
            ...parsed.data,
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
    mediaItems.push(...batchResults);
  }

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
    watchlistItems.map((item) => [getWatchlistKey(item), item]),
  );

  // Combine enriched items with watchlist data
  const itemsWithWatchlist = enrichedItems.flatMap((item) => {
    const mediaType = item.media_type === "tv" ? "tv" : "movie";
    const watchlistItem = watchlistMap.get(`${mediaType}:${item.id}`);
    if (!watchlistItem) {
      return [];
    }

    return {
      ...item,
      media_type: watchlistItem.mediaType,
      watchlistItem,
    };
  });

  // Pass all items to client (client will handle filtering/sorting)
  return (
    <div className="w-full flex flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />
      <ContentContainer className="w-full flex flex-col items-center z-10">
        <WatchlistClient
          allItems={itemsWithWatchlist}
          watchlistItems={watchlistItems}
        />
      </ContentContainer>
    </div>
  );
}
