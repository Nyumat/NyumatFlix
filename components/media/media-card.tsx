"use client";

import { Card, CardContent } from "@/components/ui/card";
import { EnhancedLink } from "@/components/ui/enhanced-link";
import type { Genre, MediaItem } from "@/utils/typings";
import { getAirDate, getTitle, isMovie } from "@/utils/typings";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";
import { match, P } from "ts-pattern";
import { Info } from "./media-info";
import { Poster } from "./media-poster";

// Define our own MovieDetails and TvDetails types based on the API responses
interface MovieDetails {
  id?: number;
  runtime?: number;
  genres?: Genre[];
}

interface TvDetails {
  id?: number;
  origin_country?: string[];
  genres?: Genre[];
}

interface MediaCardProps {
  item: MediaItem;
  type: "movie" | "tv";
}

export const MediaCard = ({ item, type }: MediaCardProps) => {
  // State to hold the details
  const [details, setDetails] = useState<MovieDetails | TvDetails | undefined>(
    undefined,
  );
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);

  useEffect(() => {
    // Reset details and set loading if item.id changes
    setDetails(undefined);
    setIsLoadingDetails(true);

    let isMounted = true; // Prevent state update on unmounted component

    const fetchDetails = async () => {
      if (!item.id) {
        setIsLoadingDetails(false);
        return;
      }
      try {
        let fetchedDetails;
        if (type === "movie") {
          // Use API route instead of direct movieDb call
          const response = await fetch(`/api/movies/${item.id}`);
          if (!response.ok)
            throw new Error(
              `Failed to fetch movie details: ${response.statusText}`,
            );
          fetchedDetails = await response.json();
        } else {
          // Use API route instead of direct movieDb call
          const response = await fetch(`/api/tv/${item.id}`);
          if (!response.ok)
            throw new Error(
              `Failed to fetch TV details: ${response.statusText}`,
            );
          fetchedDetails = await response.json();
        }
        if (isMounted) {
          setDetails(fetchedDetails);
        }
      } catch (error) {
        console.error(
          `Failed to fetch details for ${type} id ${item.id}:`,
          error,
        );
        if (isMounted) {
          setDetails(undefined); // Or handle error state appropriately
        }
      } finally {
        if (isMounted) {
          setIsLoadingDetails(false);
        }
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [item.id, type]); // Re-run if item.id or type changes

  if (item.id === undefined) {
    // This case should ideally be filtered out before reaching MediaCard
    return <div>No content ID found</div>;
  }

  // Use helper functions from typings for type-safe property access
  const title = getTitle(item);
  const posterPath = item.poster_path ?? undefined; // Convert null to undefined
  const releaseDate = getAirDate(item);
  const voteAverage = item.vote_average;

  // Details-dependent props
  const runtime = match([type, details])
    .with(
      ["movie", P.not(P.nullish)],
      ([, details]) => (details as MovieDetails).runtime,
    )
    .otherwise(() => undefined);

  const country = match(type)
    .with("tv", () => {
      if ("origin_country" in item && item.origin_country?.length) {
        return item.origin_country;
      }
      return (details as TvDetails)?.origin_country;
    })
    .otherwise(() => undefined);

  // Check if item has genres directly, otherwise use details
  const itemGenres = (() => {
    // Check if item has a genres array directly
    if ("genres" in item && Array.isArray(item.genres)) {
      return item.genres;
    }
    // Fallback to details genres
    return (details as MovieDetails | TvDetails)?.genres;
  })();

  const href = (() => {
    const itemId = (item as any).id;
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
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100">
          <EnhancedLink
            href={href}
            className="bg-primary rounded-full p-3 transform scale-0 group-hover:scale-100 transition-transform duration-300"
            mediaItem={item}
            prefetchDelay={0}
          >
            <Play size={24} className="stroke-black" />
          </EnhancedLink>
        </div>
      </CardContent>
    </Card>
  );
};
