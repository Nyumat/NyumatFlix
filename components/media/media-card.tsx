"use client";

import { Card, CardContent } from "@/components/ui/card";
import { EnhancedLink } from "@/components/ui/enhanced-link";
import type { Genre, MediaItem } from "@/utils/typings";
import { getAirDate, getTitle, isMovie } from "@/utils/typings";
import { Play } from "lucide-react";
import { match, P } from "ts-pattern";
import { Info } from "./media-info";
import { Poster } from "./media-poster";

/**
 * Movie details interface for enriched data
 */
interface MovieDetails {
  id?: number;
  runtime?: number;
  genres?: Genre[];
}

/**
 * TV show details interface for enriched data
 */
interface TvDetails {
  id?: number;
  origin_country?: string[];
  genres?: Genre[];
}

/**
 * Props for the MediaCard component
 */
interface MediaCardProps {
  /** The media item to display (should be pre-enriched with details) */
  item: MediaItem;
  /** The type of media (movie or tv) */
  type: "movie" | "tv";
}

/**
 * MediaCard component displays a single media item with poster, info, and play overlay
 * Now uses pre-enriched data instead of making individual API calls
 * @param props - The component props
 * @returns A card component displaying media information with hover interactions
 */
export const MediaCard = ({ item, type }: MediaCardProps) => {
  if (item.id === undefined) {
    return <div>No content ID found</div>;
  }

  const title = getTitle(item);
  const posterPath = item.poster_path ?? undefined;
  const releaseDate = getAirDate(item);
  const voteAverage = item.vote_average;

  // Use enriched data directly instead of making API calls
  const runtime = match([type, item])
    .with(
      ["movie", P.not(P.nullish)],
      ([, enrichedItem]) => (enrichedItem as MovieDetails).runtime,
    )
    .otherwise(() => undefined);

  const country = match(type)
    .with("tv", () => {
      if ("origin_country" in item && item.origin_country?.length) {
        return item.origin_country;
      }
      return (item as TvDetails)?.origin_country;
    })
    .otherwise(() => undefined);

  const itemGenres = (() => {
    // Check if enriched genres are available
    if ("genres" in item && Array.isArray(item.genres)) {
      return item.genres;
    }
    // Fallback: no genres available
    return undefined;
  })();

  const href = (() => {
    const itemId = item.id;
    if (isMovie(item)) {
      return `/movies/${itemId}`;
    }
    return `/tvshows/${itemId}`;
  })();

  return (
    <Card className="overflow-hidden group relative border-none h-full flex flex-col">
      <CardContent className="p-0 relative flex-grow">
        <Poster posterPath={posterPath} title={title} />
        <Info
          title={title}
          releaseDate={releaseDate}
          voteAverage={voteAverage && voteAverage > 0 ? voteAverage : undefined}
          runtime={runtime}
          country={country?.map((c) => ({ iso_3166_1: c, name: c }))}
          genres={itemGenres}
        />
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/60 dark:bg-background/0 dark:group-hover:bg-background/60 flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100">
          <EnhancedLink
            href={href}
            className="bg-primary rounded-full p-3 transform scale-0 group-hover:scale-100 transition-transform duration-300"
            mediaItem={item}
            prefetchDelay={0}
          >
            <Play className="w-16 h-16 text-background dark:text-foreground" />
          </EnhancedLink>
        </div>
      </CardContent>
    </Card>
  );
};
