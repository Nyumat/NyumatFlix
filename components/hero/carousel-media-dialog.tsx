"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { isMovie } from "@/utils/typings";
import { Calendar, Clock, Globe, Info, Play, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { match, P } from "ts-pattern";
import { Poster } from "../media/media-poster";
import { GenreBadge } from "../ui/genre-badge";
import { WatchlistButton } from "@/components/watchlist/watchlist-button";
import { MediaInfoDialogProps } from "./types";

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
        <DialogHeader className="flex-shrink-0 mb-3">
          <DialogTitle className="text-lg md:text-xl font-bold text-white pr-6">
            {titleText}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-3 md:gap-4 min-h-0">
          <div className="flex-shrink-0 w-28 md:w-40 mx-auto md:mx-0">
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
                  <Play className="mr-2 h-4 w-4" />
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
                    View Details
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
