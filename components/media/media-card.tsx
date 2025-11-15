"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { Genre, MediaItem, ProductionCountry } from "@/utils/typings";
import { getAirDate, getTitle, isMovie } from "@/utils/typings";
import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { match, P } from "ts-pattern";
import { Info } from "./media-info";
import { Poster } from "./media-poster";

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

  const handleMouseEnter = () => {
    router.prefetch(href);
  };
  return (
    <>
      <Card className="overflow-hidden relative border-none h-full flex flex-col bg-black/30 backdrop-blur-md border border-white/20 shadow-lg hover:border-primary/60 transition-colors duration-200">
        <div
          className="block relative flex-shrink-0 cursor-pointer"
          onClick={() => {
            router.push(href);
          }}
          onMouseEnter={handleMouseEnter}
        >
          <div className="relative group">
            <Poster posterPath={posterPath} title={title} altText={title} />
            <div className="hidden md:block absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 pointer-events-none p-2">
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center justify-center w-8 h-8 bg-black/70 backdrop-blur-md rounded-full border border-white/40 shadow-lg">
                  <Play className="text-white text-sm ml-0.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
};

export const MediaCard = ({ item, type, rating, minimal }: MediaCardProps) => {
  const router = useRouter();
  if (item.id === undefined) return <div>No content ID found</div>;
  const title = getTitle(item);
  const posterPath = item.poster_path ?? undefined;
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

  if (minimal) {
    return <MinimalMediaCard item={item} />;
  }

  return (
    <Card
      className="overflow-hidden relative border-none h-full flex flex-col bg-black/30 backdrop-blur-md border border-white/20 shadow-lg hover:border-primary/60 transition-colors duration-200"
      onMouseEnter={handleMouseEnter}
      onClick={() => {
        router.push(href);
      }}
    >
      <div className="block relative flex-shrink-0 cursor-pointer">
        <div className="relative group">
          <Poster posterPath={posterPath} title={title} />
          <div className="hidden md:block absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 pointer-events-none p-2">
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center justify-center w-8 h-8 bg-black/70 backdrop-blur-md rounded-full border border-white/40 shadow-lg">
                <Play className="text-white text-sm ml-0.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <CardContent className="p-0 relative h-full flex flex-col">
        <div className="flex-grow p-4">
          <Info
            title={title}
            logo={item.logo}
            releaseDate={releaseDate}
            voteAverage={
              voteAverage && voteAverage > 0 ? voteAverage : undefined
            }
            runtime={runtime}
            country={country?.map((c) => ({ iso_3166_1: c, name: c }))}
            genres={itemGenres}
            mediaType={type as "movie" | "tv"} // TODO: fix this
            rating={rating}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default MediaCard;
