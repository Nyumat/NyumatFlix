"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Icons } from "@/lib/icons";
import type { Genre, MediaItem, ProductionCountry } from "@/utils/typings";
import { getAirDate, getTitle, isMovie } from "@/utils/typings";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { match, P } from "ts-pattern";
import { Info } from "./media-info";
import { Poster } from "./media-poster";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { EpisodeIndicator } from "@/components/watchlist/episode-indicator";
import type { WatchlistItem } from "@/app/watchlist/actions";
import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";

interface MovieDetails {
  id?: number;
  runtime?: number;
  genres?: Genre[];
  production_countries?: ProductionCountry[];
}

interface TvDetails {
  id?: number;
  origin_country?: string[];
  genres?: Genre[];
}

interface MediaCardProps {
  /** The media item to display (should be pre-enriched with details) */
  item: MediaItem;
  /** The type of media (movie or tv) */
  type: "movie" | "tv" | MediaItem["media_type"];
  /** Optional content rating (e.g., PG-13, R, etc.) */
  rating?: string;
  /** Whether to show the minimal version of the card
   *  used for carosuel items within detail pages.
   */
  minimal?: boolean;
  /** Optional watchlist item for status toggle */
  watchlistItem?: WatchlistItem;
  /** Optional callback for status change */
  onStatusChange?: (
    itemId: string,
    newStatus: "watching" | "waiting" | "finished",
  ) => void;
  /** Optional episode info for TV shows */
  episodeInfo?: EpisodeInfo | null;
}

export const MinimalMediaCard = ({ item }: { item: MediaItem }) => {
  const router = useRouter();
  const href = (() => {
    const itemId = item.id;
    if (isMovie(item)) {
      return `/movies/${itemId}`;
    }
    return `/tvshows/${itemId}`;
  })();
  const title = getTitle(item);
  const posterPath = item.poster_path ?? undefined;
  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/w342${item.backdrop_path}`
    : undefined;

  const handleMouseEnter = () => {
    router.prefetch(href);
  };
  return (
    <Card
      className="group relative overflow-hidden bg-card/40 backdrop-blur-md border border-white/10 hover:border-primary/50 transition-all duration-300 shadow-xl cursor-pointer aspect-[2/3]"
      onClick={() => router.push(href)}
      onMouseEnter={handleMouseEnter}
    >
      {backdropUrl && (
        <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none">
          <Image
            src={backdropUrl}
            alt=""
            fill
            className="object-cover blur-[2px]"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      <div className="relative h-full">
        <Poster
          posterPath={posterPath}
          title={title}
          className="rounded-none h-full transition-transform duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <Icons.play
            className="text-primary-foreground w-10 h-10 scale-75 group-hover:scale-100 transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
            strokeWidth={1.5}
          />
        </div>
      </div>
    </Card>
  );
};

export const MediaCard = ({
  item,
  type,
  rating,
  minimal,
  watchlistItem,
  onStatusChange,
  episodeInfo,
}: MediaCardProps) => {
  const router = useRouter();
  if (item.id === undefined) return <div>No content ID found</div>;
  const title = getTitle(item);
  const posterPath = item.poster_path ?? undefined;
  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}`
    : undefined;
  const releaseDate = getAirDate(item);
  const voteAverage = item.vote_average;
  const runtime = match([type, item])
    .with(
      ["movie", P.not(P.nullish)],
      ([, enrichedItem]) => (enrichedItem as MovieDetails).runtime,
    )
    .otherwise(() => undefined);

  const country = match(type)
    .with("tv", () => {
      if ("origin_country" in item && item.origin_country?.length)
        return item.origin_country;
      return (item as TvDetails)?.origin_country;
    })
    .with("movie", () => {
      if (
        "production_countries" in item &&
        (item as MovieDetails).production_countries?.length
      ) {
        const productionCountries = (item as MovieDetails).production_countries;
        return productionCountries?.map(
          (pc: ProductionCountry) => pc.iso_3166_1,
        );
      }
      if ("origin_country" in item && item.origin_country?.length)
        return item.origin_country;
      return undefined;
    })
    .otherwise(() => undefined);

  const itemGenres = (() => {
    if ("genres" in item && Array.isArray(item.genres)) return item.genres;
    return undefined;
  })();

  const href = (() => {
    const itemId = item.id;
    if (isMovie(item)) {
      return `/movies/${itemId}`;
    }
    return `/tvshows/${itemId}`;
  })();

  const handleMouseEnter = () => {
    router.prefetch(href);
  };

  const handleStatusChange = (newStatus: string) => {
    if (
      watchlistItem &&
      onStatusChange &&
      (newStatus === "watching" ||
        newStatus === "waiting" ||
        newStatus === "finished")
    ) {
      onStatusChange(watchlistItem.id, newStatus);
    }
  };

  if (minimal) {
    return <MinimalMediaCard item={item} />;
  }

  return (
    <Card
      className="group relative overflow-hidden bg-card/40 backdrop-blur-md border border-white/10 hover:border-primary/50 transition-all duration-300 shadow-xl cursor-pointer h-full flex flex-col"
      onMouseEnter={handleMouseEnter}
      onClick={() => {
        router.push(href);
      }}
    >
      {backdropUrl && (
        <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none">
          <Image
            src={backdropUrl}
            alt=""
            fill
            className="object-cover blur-[2px]"
          />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent pointer-events-none md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 z-10" />

      <div className="relative flex-shrink-0">
        <div className="relative group overflow-hidden">
          <Poster
            posterPath={posterPath}
            title={title}
            className="rounded-none border-b border-white/5 transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
            <Icons.play
              className="text-primary-foreground w-12 h-12 scale-75 group-hover:scale-100 transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
              strokeWidth={1.5}
            />
          </div>

          {/* Status Toggle Overlay */}
          {watchlistItem && onStatusChange && (
            <div
              className="absolute top-3 right-3 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <ToggleGroup
                type="single"
                value={watchlistItem.status}
                onValueChange={handleStatusChange}
                className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg p-1 shadow-2xl"
              >
                <ToggleGroupItem
                  value="watching"
                  aria-label="Watching"
                  size="sm"
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                    watchlistItem.status === "watching" &&
                      "bg-primary text-primary-foreground shadow-lg",
                  )}
                >
                  Watching
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="waiting"
                  aria-label="Waiting"
                  size="sm"
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                    watchlistItem.status === "waiting" &&
                      "bg-primary text-primary-foreground shadow-lg",
                  )}
                >
                  Waiting
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="finished"
                  aria-label="Finished"
                  size="sm"
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                    watchlistItem.status === "finished" &&
                      "bg-primary text-primary-foreground shadow-lg",
                  )}
                >
                  Finished
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-4 relative flex-grow flex flex-col justify-start transition-all duration-500 md:absolute md:bottom-0 md:left-0 md:right-0 md:translate-y-4 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 z-30 md:bg-gradient-to-t md:from-black/90 md:via-black/60 md:to-transparent md:backdrop-blur-[2px]">
        <Info
          title={title}
          logo={item.logo}
          releaseDate={releaseDate}
          voteAverage={voteAverage && voteAverage > 0 ? voteAverage : undefined}
          runtime={runtime}
          country={country?.map((c) => ({ iso_3166_1: c, name: c }))}
          genres={itemGenres}
          mediaType={type as "movie" | "tv"}
          rating={rating}
          align="center"
        />
        {/* Episode Indicator */}
        {type === "tv" && item.id && (
          <div className="mt-2">
            <EpisodeIndicator
              contentId={item.id}
              mediaType="tv"
              episodeInfo={episodeInfo || null}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MediaCard;
