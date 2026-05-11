"use client";

import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";
import type { WatchlistItem } from "@/app/watchlist/actions";
import { PosterCard } from "@/components/cards";
import { Icons as LibIcons } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { CountryBadge } from "@/components/ui/country-badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SmartGenreBadgeGroup } from "@/components/ui/genre-badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EpisodeIndicator } from "@/components/watchlist/watchlist";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { cn } from "@/lib/utils";
import type { Genre, MediaItem, ProductionCountry } from "@/utils/typings";
import { Actor, Movie, TvShow, Video } from "@/utils/typings";
import { getAirDate, getTitle, isMovie } from "@/utils/typings";
import { Image as TmdbImage } from "@/tmdb/models";
import { tmdbImage } from "@/tmdb/utils";
import { Clock, Download, Expand, Link, Star, User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { match, P } from "ts-pattern";
import { MediaCard, MediaLogo, MediaPoster, Poster } from "./media-display";

interface MediaImagesProps {
  posters?: TmdbImage[];
  backdrops?: TmdbImage[];
  profiles?: TmdbImage[];
  logos?: TmdbImage[];
}

export const MediaImages: React.FC<MediaImagesProps> = ({
  posters = [],
  backdrops = [],
  profiles = [],
  logos = [],
}) => {
  const images = [...posters, ...backdrops, ...profiles, ...logos];
  const { copied, copy } = useCopyToClipboard();

  if (!images.length) return <div className="empty-box">No images</div>;

  return (
    <div className="grid-list items-center gap-4">
      {images.map(({ file_path, aspect_ratio }) => (
        <Dialog key={file_path}>
          <DialogTrigger>
            <div
              key={file_path}
              className={cn(
                aspect_ratio > 1
                  ? "col-span-2 aspect-video lg:col-span-3 xl:col-span-2"
                  : "aspect-poster",
                "group relative block transition",
              )}
            >
              <Image
                src={tmdbImage.url(file_path, "w780")}
                alt={file_path}
                className="size-full rounded-md border"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                fill
              />

              <div className="overlay grid place-items-center opacity-0 transition group-hover:opacity-100">
                <Expand />
              </div>
            </div>
          </DialogTrigger>

          <DialogContent
            className={cn(aspect_ratio > 1 && "max-w-(--breakpoint-xl)")}
          >
            <div
              className={cn(
                aspect_ratio > 1 ? "aspect-video" : "aspect-poster",
              )}
            >
              <Image
                src={tmdbImage.url(file_path, "original")}
                alt={file_path}
                className="rounded-md border bg-muted"
                sizes="(min-width: 1280px) 80vw, 90vw"
                fill
              />
            </div>

            <div className="absolute bottom-0 left-0 flex h-32 w-full items-end justify-end space-x-2 bg-linear-to-t from-background to-transparent pb-4 pr-4">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(tmdbImage.url(file_path, "w780"))}
              >
                <Link className="size-4" />
                <span className="sr-only md:not-sr-only md:ml-2">
                  {copied ? "Copied!" : "Copy link"}
                </span>
              </Button>

              <Button asChild size="sm" variant="ghost">
                <a
                  href={tmdbImage.url(file_path, "original")}
                  download
                  target="_blank"
                >
                  <Download className="size-4" />
                  <span className="sr-only md:not-sr-only md:ml-2">Save</span>
                </a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
};

/**
 * Props for the Info component
 */
interface InfoProps {
  /** Title of the media content */
  title?: string;
  /** Logo object for displaying media logo */
  logo?: {
    file_path: string;
    width: number;
    height: number;
  };
  /** Release date for movies or first air date for TV shows */
  releaseDate?: string;
  /** Average vote rating (0-10) */
  voteAverage?: number;
  /** Runtime in minutes (for movies) */
  runtime?: number;
  /** Production countries (for TV shows) */
  country?: Array<{ iso_3166_1: string; name: string }>;
  /** Array of genre objects for displaying genre badges */
  genres?: Genre[];
  /** Type of media - used for conditional rendering */
  mediaType?: "movie" | "tv";
  /** Optional content rating (e.g., PG-13, R, etc.) */
  rating?: string;
  /**
   * Alignment of the content
   * @default "left"
   */
  align?: "left" | "center" | "right";
}

/**
 * Info component displays media information including title, rating, runtime, and genres
 * @param props - The component props
 * @returns A component displaying formatted media information
 */
export const Info = ({
  title,
  logo,
  releaseDate,
  voteAverage,
  runtime,
  country,
  genres,
  mediaType = "movie",
  rating,
  align = "left",
}: InfoProps) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "TBA";
    try {
      return new Date(dateString).getFullYear().toString();
    } catch {
      return "TBA";
    }
  };

  const formatRuntime = (minutes?: number) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${remainingMinutes}m`;
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 py-1 text-foreground",
        align === "left" && "items-start text-left",
        align === "center" && "items-center text-center",
        align === "right" && "items-end text-right",
      )}
    >
      <MediaLogo
        logo={logo}
        title={title}
        align={align}
        className="mb-1 max-w-[200px]"
        fallbackClassName="mb-1 text-sm sm:text-base md:text-lg font-semibold leading-tight line-clamp-2 text-balance"
      />

      <div className="flex items-center gap-2 text-[11px] sm:text-xs text-muted-foreground/80 font-medium flex-wrap justify-center">
        <span>{formatDate(releaseDate)}</span>

        {voteAverage && voteAverage > 0 && (
          <>
            <span className="opacity-40">•</span>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="text-foreground/90 font-medium">
                {voteAverage.toFixed(1)}
              </span>
            </div>
          </>
        )}

        {runtime && (
          <>
            <span className="opacity-40">•</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatRuntime(runtime)}</span>
            </div>
          </>
        )}
      </div>

      <div
        className={cn(
          "flex items-center gap-1.5 flex-wrap mt-1",
          align === "center" && "justify-center",
        )}
      >
        {rating && (
          <Badge
            variant="outline"
            className="text-[9px] py-0 h-4 px-1.5 bg-white/5 border-white/20 text-white/70 font-medium rounded-xs whitespace-nowrap"
          >
            {rating}
          </Badge>
        )}

        {country && country.length > 0 && (
          <CountryBadge
            country={country[0]}
            variant="outline"
            className="text-[9px] py-0 h-4 px-1.5 bg-white/5 border-white/20 text-white/70 font-normal rounded-xs"
            size="sm"
            showName={false}
            mediaType={mediaType}
          />
        )}

        {genres && genres.length > 0 && (
          <SmartGenreBadgeGroup
            genreIds={genres.map((g) => g.id)}
            mediaType={mediaType}
            maxVisible={1}
            className="flex flex-wrap gap-1 items-center"
            badgeClassName="text-[9px] h-4 leading-none bg-white/5 text-white/70 px-1.5 py-0 font-normal hover:bg-primary/20 hover:text-primary hover:border-primary/30 transition-colors rounded-xs"
            variant="outline"
          />
        )}
      </div>
    </div>
  );
};

type MediaCarouselsProps = {
  cast?: Actor[];
  videos?: Video[];
  recommendations?: (Movie | TvShow)[];
  mediaType: "movie" | "tv";
};

export function MediaCarousels({
  cast = [],
  videos = [],
  recommendations = [],
  mediaType,
}: MediaCarouselsProps) {
  return (
    <div className="space-y-8">
      {cast.length > 0 && <CastCarousel cast={cast} />}
      {videos.length > 0 && <VideoCarousel videos={videos} />}
      {recommendations.length > 0 && (
        <RecommendationsCarousel
          recommendations={recommendations}
          mediaType={mediaType}
        />
      )}
    </div>
  );
}

type CastCarouselProps = {
  cast: Actor[];
};

export function CastCarousel({ cast }: CastCarouselProps) {
  const router = useRouter();
  if (!cast.length) return null;

  const handlePersonMouseEnter = (person: Actor) => {
    router.prefetch(`/person/${person.id}`);
  };

  return (
    <section id="section-cast" className="scroll-mt-24 py-2">
      <h2 className="text-2xl font-semibold text-foreground mb-4">Cast</h2>
      <div className="relative">
        <Carousel
          opts={{
            dragFree: true,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent>
            {cast.slice(0, 20).map((person: Actor) => (
              <CarouselItem
                key={person.id}
                className="basis-1/3 sm:basis-1/4 md:basis-1/5 lg:basis-1/6 xl:basis-1/8"
              >
                <div
                  className="w-full shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => router.push(`/person/${person.id}`)}
                  onMouseEnter={() => handlePersonMouseEnter(person)}
                >
                  <div className="rounded-lg overflow-hidden mb-3 aspect-2/3 bg-muted">
                    {person.profile_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                        alt={person.name}
                        width={185}
                        height={278}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <User size={48} />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="text-foreground font-medium text-sm mb-1 line-clamp-2">
                      {person.name}
                    </h3>
                    <p className="text-muted-foreground text-xs line-clamp-2">
                      {person.character}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-xs" />
          <CarouselNext className="right-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-xs" />
        </Carousel>
      </div>
    </section>
  );
}

type VideoCarouselProps = {
  videos: Video[];
};

export function VideoCarousel({ videos }: VideoCarouselProps) {
  const [failedVideos, setFailedVideos] = useState<Set<string>>(new Set());

  if (!videos.length) return null;

  const handleVideoError = (videoId: string, videoName: string) => {
    if (!failedVideos.has(videoId)) {
      setFailedVideos((prev) => {
        const updated = new Set(prev);
        updated.add(videoId);
        return updated;
      });

      toast.error(`Failed to load video: ${videoName}`);
    }
  };

  const youtubeVideos = videos.filter((video) => video.site === "YouTube");

  return (
    <section id="section-videos" className="scroll-mt-24">
      <h2 className="text-2xl font-semibold text-foreground mb-4">Videos</h2>
      <div className="relative">
        <Carousel
          opts={{
            dragFree: true,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent>
            {youtubeVideos.slice(0, 10).map((video: Video) => (
              <CarouselItem key={video.id} className="basis-1/2 sm:basis-1/3">
                <div className="w-full shrink-0">
                  <div className="rounded-lg overflow-hidden mb-3 aspect-video bg-muted">
                    <iframe
                      src={`https://www.youtube.com/embed/${video.key}`}
                      title={video.name}
                      className="w-full h-full"
                      allowFullScreen
                      onError={() => handleVideoError(video.id, video.name)}
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="text-foreground font-medium text-sm mb-1 line-clamp-2">
                      {video.name}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {video.type}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-xs" />
          <CarouselNext className="right-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-xs" />
        </Carousel>
      </div>
    </section>
  );
}

type RecommendationsCarouselProps = {
  recommendations: (Movie | TvShow)[];
  mediaType: "movie" | "tv";
};

export function RecommendationsCarousel({
  recommendations,
  mediaType,
}: RecommendationsCarouselProps) {
  const router = useRouter();
  if (!recommendations.length) return null;

  const getHref = (item: Movie | TvShow) => {
    const type = "title" in item ? "movies" : "tvshows";
    return `/${type}/${item.id}`;
  };

  const handleItemMouseEnter = (item: Movie | TvShow) => {
    const href = getHref(item);
    router.prefetch(href);
  };

  const sectionTitle = mediaType === "movie" ? "Similar Movies" : "Recommended";

  return (
    <section id="section-recommendations" className="scroll-mt-24">
      <h2 className="text-2xl font-semibold text-foreground mb-4">
        {sectionTitle}
      </h2>
      <div className="relative">
        <Carousel
          opts={{
            dragFree: true,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent>
            {recommendations.slice(0, 20).map((item: Movie | TvShow) => (
              <CarouselItem
                key={item.id}
                className="basis-1/3 sm:basis-1/4 md:basis-1/5 lg:basis-1/6 xl:basis-1/8 w-full shrink-0 hover:opacity-80 transition block"
                onClick={() => {
                  router.push(getHref(item));
                }}
                onMouseEnter={() => handleItemMouseEnter(item)}
              >
                <MediaShowcaseCard
                  item={item}
                  type={mediaType}
                  rating={item.vote_average?.toString()}
                  minimal
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-xs" />
          <CarouselNext className="right-2 bg-background/80 hover:bg-background/90 border border-border text-foreground backdrop-blur-xs" />
        </Carousel>
      </div>
    </section>
  );
}

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
  return <PosterCard item={item} minimal />;
};

export const MediaShowcaseCard = ({
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
      className="group relative overflow-hidden border-0 bg-card/40 backdrop-blur-md transition-all duration-300 shadow-xl cursor-pointer h-full flex flex-col"
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
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover blur-[2px]"
          />
        </div>
      )}

      <div className="absolute inset-0 bg-linear-to-t from-background/95 via-background/40 to-transparent pointer-events-none md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 z-10" />

      <div className="relative shrink-0">
        <div className="relative group overflow-hidden">
          <Poster
            posterPath={posterPath}
            title={title}
            className="rounded-none transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
            <LibIcons.play
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
                className="bg-black/60 backdrop-blur-xl rounded-lg p-1 shadow-2xl"
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

      <CardContent className="p-4 relative grow flex flex-col justify-start transition-all duration-500 md:absolute md:bottom-0 md:left-0 md:right-0 md:translate-y-4 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 z-30 md:bg-linear-to-t md:from-black/90 md:via-black/60 md:to-transparent md:backdrop-blur-[2px]">
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

export default MediaShowcaseCard;
