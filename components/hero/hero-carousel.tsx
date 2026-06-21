"use client";

import { GenreBadge } from "@/components/media/controls/genre-badge";
import { MediaLogo, Poster } from "@/components/media/media-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WatchlistButton } from "@/components/watchlist/watchlist";
import { isMovie, type MediaItem } from "@/lib/domain/typings";
import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Calendar, Clock, Globe, Info, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { match, P } from "ts-pattern";
import type { CarouselDetailsProps, MediaInfoDialogProps } from "./types";

export function MediaInfoDialog({
  isOpen,
  onClose,
  media,
}: MediaInfoDialogProps) {
  const router = useRouter();

  const titleText = match(media)
    .with({ title: P.string }, (movie) => movie.title)
    .otherwise((tvShow) => tvShow.name);

  const year = match(media)
    .with(
      {
        title: P.string,
        release_date: P.string.optional(),
      },
      (movie) => movie.release_date?.substring(0, 4),
    )
    .with(
      {
        name: P.string,
        first_air_date: P.string.optional(),
      },
      (tvShow) => tvShow.first_air_date?.substring(0, 4),
    )
    .otherwise(() => undefined);

  const isMovieItem = isMovie(media);
  const mediaType = isMovieItem ? "Movie" : "TV Show";
  const mediaInfoDialogType = isMovieItem ? "movie" : "tv";

  const runtime =
    isMovieItem && "runtime" in media
      ? (media as typeof media & { runtime?: number }).runtime
      : undefined;
  const contentRating =
    "content_rating" in media
      ? (media as typeof media & { content_rating?: string }).content_rating
      : undefined;
  const genres =
    "genres" in media
      ? (
          media as typeof media & {
            genres?: Array<{ id: number; name: string }>;
          }
        ).genres
      : undefined;

  const formatRuntime = (minutes?: number) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${remainingMinutes}m`;
  };

  const href = match(media)
    .with({ title: P.string, id: P.number }, (movie) => `/movies/${movie.id}`)
    .with({ name: P.string, id: P.number }, (tvShow) => `/tvshows/${tvShow.id}`)
    .otherwise(() => "#");

  const handleWatchNow = () => {
    onClose();
    router.push(`${href}?autoplay=true`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "w-[95vw] max-w-3xl max-h-[90vh] mx-4 p-4 md:p-6",
          "bg-black/60 backdrop-blur-md border border-white/20 shadow-xl",
        )}
      >
        <DialogHeader className="shrink-0 mb-3">
          <DialogTitle className="text-lg md:text-xl font-bold text-white pr-6">
            {titleText}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-3 md:gap-4 min-h-0">
          <div className="shrink-0 w-28 md:w-40 mx-auto md:mx-0">
            <Poster
              posterPath={media.poster_path ?? undefined}
              title={titleText}
              size="medium"
              className="rounded-lg shadow-xl"
            />
          </div>

          <div className="flex-1 min-w-0">
            <ScrollArea className="h-[40vh] md:h-[50vh] pr-1 md:pr-2">
              <div
                className={cn(
                  "bg-black/30 backdrop-blur-md border border-white/20 rounded-lg p-3 mb-3 shadow-lg",
                  "flex flex-wrap items-center gap-2",
                )}
              >
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="font-semibold text-sm md:text-base text-white">
                    {media.vote_average.toFixed(1)}/10
                  </span>
                </div>

                {year && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-300" />
                    <span className="text-sm md:text-base text-white">
                      {year}
                    </span>
                  </div>
                )}

                {runtime && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-gray-300" />
                    <span className="text-sm md:text-base text-white">
                      {formatRuntime(runtime)}
                    </span>
                  </div>
                )}

                <Badge
                  variant="outline"
                  className="text-xs md:text-sm bg-white/10 border-white/20 text-white"
                >
                  {mediaType}
                </Badge>

                {contentRating && (
                  <Badge
                    variant="outline"
                    className="text-xs md:text-sm bg-white/15 border-white/30 text-white"
                  >
                    {contentRating}
                  </Badge>
                )}
              </div>
              {genres && genres.length > 0 && (
                <div className="mb-3">
                  <h4 className="font-semibold mb-1 text-sm md:text-base text-white">
                    Genres
                  </h4>
                  <div className="flex flex-wrap gap-1 pl-1">
                    {genres.map((genre) => (
                      <GenreBadge
                        key={genre.id}
                        genreId={genre.id}
                        className="text-xs bg-white/10 border-white/20 text-white"
                        genreName={genre.name}
                        mediaType={mediaInfoDialogType}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="mb-3">
                <h4 className="font-semibold mb-1 text-sm md:text-base text-white">
                  Overview
                </h4>
                <p className="text-gray-300 leading-relaxed text-sm">
                  {media.overview}
                </p>
              </div>
              <div
                className={cn(
                  "bg-black/30 backdrop-blur-md border border-white/20 rounded-lg p-3 mb-3 shadow-lg",
                  "grid grid-cols-1 sm:grid-cols-2 gap-3",
                )}
              >
                <div>
                  <h4 className="font-semibold mb-1 text-sm text-white">
                    Language
                  </h4>
                  <p className="text-xs text-gray-300 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {media.original_language?.toUpperCase()}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1 text-sm text-white">
                    Popularity
                  </h4>
                  <p className="text-xs text-gray-300">
                    {Math.round(media.popularity)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleWatchNow}
                  className={cn(
                    "flex-1 font-bold transition-all duration-200 shadow-lg",
                    "backdrop-blur-md bg-white/20 border border-white/30 text-white",
                    "hover:bg-white/30 hover:border-white/40 hover:shadow-xl",
                  )}
                >
                  <Icons.play className="mr-2 h-4 w-4" />
                  Watch Now
                </Button>
                {typeof media.id === "number" && (
                  <WatchlistButton
                    contentId={media.id}
                    mediaType={mediaInfoDialogType}
                    variant="outline"
                    className={cn(
                      "flex-1 font-bold transition-all duration-200 shadow-lg",
                      "backdrop-blur-md bg-white/10 border border-white/30 text-white",
                      "hover:bg-white/20 hover:border-white/40 hover:shadow-xl",
                    )}
                  >
                    Watchlist
                  </WatchlistButton>
                )}
                <Button
                  asChild
                  className={cn(
                    "flex-1 font-bold transition-all duration-200 shadow-lg",
                    "backdrop-blur-md bg-white/10 border border-white/30 text-white",
                    "hover:bg-white/20 hover:border-white/40 hover:shadow-xl",
                  )}
                >
                  <Link
                    href={href}
                    className="flex items-center justify-center"
                  >
                    <Info className="mr-2 h-4 w-4" />
                    Watch Now
                  </Link>
                </Button>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const CarouselDetails = React.memo(function CarouselDetails({
  current,
  items,
  onPosterClick,
}: CarouselDetailsProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMedia, setDialogMedia] = useState<MediaItem | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const router = useRouter();

  const titleText = useMemo(
    () =>
      match(current)
        .with({ title: P.string }, (movie) => movie.title)
        .otherwise((tvShow) => tvShow.name),
    [current],
  );

  const year = useMemo(
    () =>
      match(current)
        .with({ title: P.string, release_date: P.string.optional() }, (movie) =>
          movie.release_date?.substring(0, 4),
        )
        .with(
          { name: P.string, first_air_date: P.string.optional() },
          (tvShow) => tvShow.first_air_date?.substring(0, 4),
        )
        .otherwise(() => undefined),
    [current],
  );

  const href = useMemo(
    () =>
      match(current)
        .with(
          { title: P.string, id: P.number },
          (movie) => `/movies/${movie.id}`,
        )
        .with(
          { name: P.string, id: P.number },
          (tvShow) => `/tvshows/${tvShow.id}`,
        )
        .otherwise(() => "#"),
    [current],
  );

  const handlePlay = useMemo(
    () => () => {
      router.push(`${href}?autoplay=true`);
    },
    [router, href],
  );

  useEffect(() => {
    if (carouselApi) {
      const currentIndex = items.findIndex((item) => item.id === current.id);
      if (currentIndex !== -1) {
        carouselApi.scrollTo(currentIndex);
      }
    }
  }, [current.id, items, carouselApi]);

  return (
    <>
      <div className="absolute bottom-0 left-0 p-4 md:p-8 lg:p-12 w-full md:w-3/4 lg:w-1/2 hidden md:block">
        <div className={cn("p-4 rounded-lg")}>
          {current.logo ? (
            <div className="mb-4">
              <MediaLogo
                logo={current.logo}
                title={titleText}
                size="large"
                maxHeight="300px"
              />
            </div>
          ) : (
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 shadow-black/50 text-shadow-lg">
              {titleText}
            </h1>
          )}

          <div className="flex items-center mb-4 space-x-4 flex-wrap">
            <div className="flex items-center space-x-1">
              <Star className="text-yellow-400 w-5 h-5" />
              <span className="text-white font-semibold">
                {current.vote_average.toFixed(1)}
              </span>
            </div>
            {year && <span className="text-gray-300">{year}</span>}

            {/* Content rating/certification */}
            {current.content_rating && (
              <span className="px-2 py-1 bg-white/20 rounded text-xs font-medium border border-white/30 text-white">
                {current.content_rating}
              </span>
            )}

            {/* Runtime for movies */}
            {match(current)
              .with({ title: P.string, runtime: P.number }, (movie) => (
                <span className="text-gray-300">
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </span>
              ))
              .otherwise(() => null)}

            {/* Seasons and episodes for TV shows */}
            {match(current)
              .with(
                {
                  name: P.string,
                  number_of_seasons: P.number.optional(),
                  number_of_episodes: P.number.optional(),
                },
                (tvShow) => {
                  const seasons = tvShow.number_of_seasons;
                  const episodes = tvShow.number_of_episodes;
                  return (
                    <span className="text-gray-300">
                      {seasons && seasons > 0 && (
                        <>
                          {seasons} Season{seasons !== 1 ? "s" : ""}
                          {episodes && episodes > 0 && (
                            <>
                              {" "}
                              • {episodes} Episode{episodes !== 1 ? "s" : ""}
                            </>
                          )}
                        </>
                      )}
                    </span>
                  );
                },
              )
              .otherwise(() => null)}
          </div>

          <p className="text-white/90 text-sm md:text-base max-w-xl mb-6 line-clamp-2 md:line-clamp-3">
            {current.overview}
          </p>

          <div className="flex items-center space-x-4 mb-6">
            <Button
              onClick={handlePlay}
              size="lg"
              className={cn(
                "font-bold transition-all duration-200 shadow-lg",
                "backdrop-blur-md bg-white/20 border border-white/30 text-white",
                "hover:bg-white/30 hover:border-white/40 hover:shadow-xl",
              )}
            >
              <Icons.play className="mr-2 h-5 w-5" />
              Play
            </Button>
            <Button
              size="lg"
              onClick={() => {
                setDialogMedia(current);
                setShowDialog(true);
              }}
              className={cn(
                "font-bold transition-all duration-200 shadow-lg",
                "backdrop-blur-md bg-white/10 border border-white/30 text-white",
                "hover:bg-white/20 hover:border-white/40 hover:shadow-xl",
              )}
            >
              <Info className="mr-2 h-5 w-5" />
              More Info
            </Button>
          </div>

          <div className="relative hidden lg:block">
            <Carousel
              setApi={setCarouselApi}
              opts={{
                align: "start",
                loop: false,
                skipSnaps: true,
                dragFree: true,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-3">
                {items.map((item, index) => {
                  const isActive = item.id === current.id;
                  const itemTitle = match(item)
                    .with({ title: P.string }, (m) => m.title)
                    .otherwise((t) => t.name);

                  return (
                    <CarouselItem
                      key={item.id}
                      className="pl-3 basis-1/4 md:basis-1/5 lg:basis-1/6"
                      onClick={() => onPosterClick(index)}
                    >
                      <div className="flex flex-col items-center text-center cursor-pointer group">
                        <div
                          className={`relative w-full rounded-lg overflow-hidden transition-all duration-300 transform-gpu ${
                            isActive
                              ? "border-2 border-primary"
                              : "border-2 border-transparent"
                          }`}
                        >
                          <Poster
                            posterPath={item.poster_path ?? undefined}
                            title={itemTitle}
                            size="small"
                            className="transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <p
                          className={`mt-2 text-xs font-medium text-white transition-opacity duration-300 line-clamp-2 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                        >
                          {itemTitle}
                        </p>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white z-10" />
            </Carousel>
          </div>
        </div>
      </div>

      {dialogMedia && (
        <MediaInfoDialog
          isOpen={showDialog}
          onClose={() => {
            setShowDialog(false);
            setDialogMedia(null);
          }}
          media={dialogMedia}
        />
      )}
    </>
  );
});

/**
 * Props for the HeroBackground component
 */
