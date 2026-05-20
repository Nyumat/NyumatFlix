"use client";

import { WatchlistItem } from "@/app/watchlist/actions";
import { getGenreNames } from "@/components/content/genre-helpers";
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
import { GenreBadge, PrimaryGenreBadge } from "@/components/ui/genre-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ServerSelector } from "@/components/ui/server-selector";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WatchlistButton } from "@/components/watchlist/watchlist";
import { pages } from "@/config";
import type { VideasyTrailerStreamStatus } from "@/hooks/use-videasy-trailer-stream";
import { useMediaHero } from "@/hooks/useMediaHero";
import { Icons } from "@/lib/icons";
import {
  extractVideoRowsFromMediaVideos,
  selectPrimaryTrailerKey,
  selectPrimaryTrailerVideo,
  type TrailerPickRow,
} from "@/lib/select-primary-trailer-video";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useMediaDetailTabStore } from "@/lib/stores/media-detail-tab-store";
import { useServerStore } from "@/lib/stores/server-store";
import { cn, logger } from "@/lib/utils";
import {
  getCountryFlagEmoji,
  getFriendlyCountryName,
} from "@/utils/country-helpers";
import { Episode, isMovie, MediaItem, Movie, TvShow } from "@/utils/typings";
import Fade from "embla-carousel-fade";
import {
  AnimatePresence,
  LegacyAnimationControls,
  motion,
} from "framer-motion";
import {
  Calendar,
  Clock,
  DollarSign,
  Globe,
  Info,
  Star,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  X,
  Youtube,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { match, P } from "ts-pattern";
import {
  BackgroundImageProps,
  CarouselDetailsProps,
  HeroProps,
  MediaCarouselProps,
  MediaInfoDialogProps,
  type TvHeroEpisodeData,
} from "./types";
import { VideasyStreamVideo } from "./videasy-stream-video";
import {
  HERO_YOUTUBE_CHROMELESS_BASE,
  type YouTubePlayer,
} from "./youtube-types";

// --- hero-gradients.tsx ---
export function HeroGradients() {
  return null;
}

// --- hero-details.tsx ---
interface HeroDetailsProps {
  formattedDate: string;
  runtime?: number;
  budget?: number;
  voteAverage?: number;
  isWatch: boolean;
  seasons?: number;
  episodes?: number;
  isUpcoming?: boolean;
  hideSeasonEpisodeCounts?: boolean;
}

export function HeroDetails({
  formattedDate,
  runtime,
  budget,
  voteAverage,
  isWatch,
  seasons,
  episodes,
  isUpcoming = false,
  hideSeasonEpisodeCounts = false,
}: HeroDetailsProps) {
  const showDuration = runtime !== undefined && runtime > 0 && !isUpcoming;
  const showBudget = budget !== undefined && budget > 0 && !isUpcoming;
  const showSeasons =
    !hideSeasonEpisodeCounts && seasons !== undefined && seasons > 0;
  const showEpisodes =
    !hideSeasonEpisodeCounts && episodes !== undefined && episodes > 0;
  const showRating =
    voteAverage !== undefined && voteAverage > 0 && !isUpcoming;

  return (
    <div className="flex items-center flex-wrap gap-3 mb-4 text-gray-300">
      {formattedDate && (
        <div className="flex items-center">
          <Calendar className="mr-2" size={16} />
          <span suppressHydrationWarning>{formattedDate}</span>
        </div>
      )}

      {isWatch && showDuration && (
        <div className="flex items-center">
          <Clock className="mr-2" size={16} />
          <span>{runtime} min</span>
        </div>
      )}

      {isWatch && showBudget && (
        <div className="flex items-center">
          <DollarSign className="mr-2" size={16} />
          <span>${budget?.toLocaleString()}</span>
        </div>
      )}

      {isWatch && showSeasons && (
        <div className="flex items-center">
          <span className="mr-2">Seasons: {seasons}</span>
        </div>
      )}

      {isWatch && showEpisodes && (
        <div className="flex items-center">
          <span className="mr-2">Episodes: {episodes}</span>
        </div>
      )}

      {showRating && (
        <div className="flex items-center">
          <Star className="mr-2" size={16} />
          <span>{voteAverage?.toFixed(1)}</span>
        </div>
      )}

      {isUpcoming && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="chrome" className="text-sm px-4 py-1.5 cursor-help">
              Upcoming
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>This content is not yet available for streaming</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// --- hero-genres.tsx ---
interface HeroGenresProps {
  genres?: { id: number; name: string }[];
  mediaType?: "movie" | "tv";
}

export function HeroGenres({ genres, mediaType }: HeroGenresProps) {
  if (!genres || genres.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {genres.map((genre) => (
        <PrimaryGenreBadge
          key={genre.id}
          genreId={genre.id}
          genreName={genre.name}
          mediaType={mediaType}
        />
      ))}
    </div>
  );
}

// --- hero-pagination.tsx ---
interface HeroPaginationProps {
  /** Array of items to paginate through */
  items: MediaItem[];
  /** Index of the currently active item */
  currentIndex: number;
  /** Optional click handler when a dot is selected */
  onItemSelect?: (index: number) => void;
}

export function HeroPagination({
  items,
  currentIndex,
  onItemSelect,
}: HeroPaginationProps) {
  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2 z-30">
      {items.map((_, index) => {
        const isActive = index === currentIndex;
        const className = `w-2 h-2 rounded-full transition-colors duration-200 ${isActive ? "bg-foreground" : "bg-foreground/50 hover:bg-foreground"}`;

        if (!onItemSelect) {
          return <div key={index} className={className} />;
        }

        return (
          <button
            key={index}
            aria-label={`Go to slide ${index + 1}`}
            onClick={() => onItemSelect(index)}
            className={className}
          />
        );
      })}
    </div>
  );
}

// --- hero-buttons.tsx ---
interface HeroButtonsProps {
  handleWatch(): void;
  handlePlayTrailer(): void;
  mediaType?: "tv" | "movie";
  isUpcoming?: boolean;
  contentId: number;
  watchlistItem?: WatchlistItem | null;
  initialEpisode?: Episode | null;
  initialSeasonNumber?: number | null;
  canPlayTrailer: boolean;
}

export function HeroButtons({
  handleWatch,
  handlePlayTrailer,
  mediaType,
  isUpcoming = false,
  contentId,
  watchlistItem,
  initialEpisode,
  initialSeasonNumber,
  canPlayTrailer,
}: HeroButtonsProps) {
  const { selectedEpisode, setSelectedEpisode } = useEpisodeStore();
  const router = useRouter();
  const pathname = usePathname();

  const showEpisodeList = () => {
    const id = String(contentId);
    const basePath = `${pages.tv.root.link}/${id}`;

    useMediaDetailTabStore
      .getState()
      .setMediaDetailTab("tv", id, "seasons-episodes");

    const scrollToEpisodePanel = (attempt = 0) => {
      const tabPanel =
        document.querySelector("[data-episode-browser]") ||
        document.getElementById("seasons-episodes-panel");

      if (tabPanel) {
        tabPanel.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        return;
      }

      if (attempt < 8) {
        window.setTimeout(() => scrollToEpisodePanel(attempt + 1), 100);
      }
    };

    if (pathname !== basePath) {
      router.push(basePath);
      window.setTimeout(scrollToEpisodePanel, 100);
      return;
    }

    requestAnimationFrame(scrollToEpisodePanel);
  };

  const handleWatchClick = () => {
    // For TV shows, require episode selection
    if (mediaType === "tv") {
      const episodeToUse = selectedEpisode || initialEpisode;

      if (!episodeToUse) {
        showEpisodeList();
        return;
      }

      if (!selectedEpisode && initialEpisode && initialSeasonNumber) {
        // If we're using initialEpisode but it's not in the store yet, set it
        setSelectedEpisode(
          initialEpisode,
          contentId.toString(),
          initialSeasonNumber,
          undefined,
          false, // Don't skip callback - we want to watch
        );
        // The callback will be triggered, which calls handleWatch
        return;
      }
    }

    // Proceed with watch
    handleWatch();
  };

  const getWatchButtonText = () => {
    if (isUpcoming) {
      return "Coming Soon";
    }
    if (mediaType === "tv") {
      if (selectedEpisode) {
        return `Watch S${useEpisodeStore.getState().seasonNumber}E${selectedEpisode.episode_number}`;
      }
      if (
        watchlistItem?.lastWatchedSeason &&
        watchlistItem?.lastWatchedEpisode
      ) {
        return `Watch S${watchlistItem.lastWatchedSeason}E${watchlistItem.lastWatchedEpisode}`;
      }
      return "Episodes";
    }
    return "Play";
  };

  const isWatchDisabled = isUpcoming;

  const getDisabledTooltip = () => {
    if (isUpcoming) {
      return "This content is not yet available for streaming";
    }
    return "";
  };

  const disabledTooltip = getDisabledTooltip();

  const TrailerButton = (
    <button
      type="button"
      className={cn(
        "backdrop-blur-md bg-white/10 border border-white/30 text-white py-2 px-4 rounded-full font-bold transition flex items-center shadow-lg whitespace-nowrap",
        canPlayTrailer
          ? "hover:bg-white/20 hover:border-white/40 hover:shadow-xl"
          : "opacity-50 cursor-not-allowed",
      )}
      onClick={handlePlayTrailer}
      disabled={!canPlayTrailer}
      aria-disabled={!canPlayTrailer}
      aria-label={
        canPlayTrailer ? "Play trailer" : "Trailer not available for this title"
      }
    >
      <Youtube className="mr-2 h-4 w-4" />
      <span className="text-sm">Trailer</span>
    </button>
  );

  const WatchButton = (
    <button
      onClick={handleWatchClick}
      disabled={isWatchDisabled}
      className={cn(
        "backdrop-blur-md bg-white border border-white/60 text-black py-2 px-4 rounded-full font-bold transition flex items-center shadow-lg whitespace-nowrap",
        isWatchDisabled
          ? "bg-white/60 border-white/50 text-black/50 cursor-not-allowed"
          : "cursor-pointer hover:bg-white/90 hover:border-white/70 hover:shadow-xl",
      )}
    >
      <Icons.play className="mr-2 h-4 w-4 text-black fill-black stroke-black" />
      <span className="text-sm">{getWatchButtonText()}</span>
    </button>
  );

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {isWatchDisabled ? (
        <Tooltip>
          <TooltipTrigger asChild>{WatchButton}</TooltipTrigger>
          <TooltipContent>
            <p>{disabledTooltip}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        WatchButton
      )}

      <WatchlistButton
        contentId={contentId}
        mediaType={mediaType}
        variant="outline"
        size="default"
        className="backdrop-blur-md bg-white/10 border border-white/30 text-white hover:bg-white/20 hover:border-white/40"
      />

      {!canPlayTrailer ? (
        <Tooltip>
          <TooltipTrigger asChild>{TrailerButton}</TooltipTrigger>
          <TooltipContent>
            <p>No trailer is available for this title yet.</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        TrailerButton
      )}
    </div>
  );
}

// --- carousel-background.tsx ---
export function BackgroundImage({
  isFullPage,
  imageUrl,
  title,
  logo,
  hideTitle = false,
  overlayClassName,
}: BackgroundImageProps) {
  const backgroundImage = imageUrl;

  return (
    <div
      className={`${
        isFullPage
          ? "fixed inset-0 h-dvh w-full"
          : "absolute w-full h-[40vh] inset-x-0"
      } z-0 overflow-hidden`}
    >
      <Image
        src={backgroundImage}
        alt={title}
        width={1920}
        height={1080}
        className={`${isFullPage ? "" : "rounded-lg"} object-cover w-full h-full`}
        priority
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-black/70",
          overlayClassName,
        )}
      />

      {!hideTitle && (isFullPage || logo) && title && (
        <div className="absolute inset-0 flex items-center justify-center">
          {logo && typeof logo === "object" && "file_path" in logo ? (
            <div className="px-4">
              <MediaLogo
                logo={logo}
                title={title}
                size="large"
                maxWidth={isFullPage ? "500px" : "300px"}
              />
            </div>
          ) : (
            <div className="text-center my-12 mt-44">
              {logo && typeof logo === "string" ? (
                <div className="flex justify-center items-center">
                  <Image
                    src={logo}
                    alt={title}
                    width={400}
                    height={200}
                    className="max-w-full h-auto"
                    priority
                  />
                </div>
              ) : (
                <h1 className="text-6xl md:text-7xl font-bold text-foreground tracking-tight px-4">
                  {title}
                </h1>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- carousel-static.tsx ---
export function StaticHero({
  imageUrl,
  title,
  route,
  logo,
  hideTitle = false,
}: HeroProps) {
  const pathname = usePathname();
  const isSearchPage = pathname === "/search" || !!route;
  const isBrowsePage = pathname.includes("/browse");
  const isCatalogPage =
    pathname === "/" ||
    pathname === "/movies" ||
    pathname === "/tvshows" ||
    pathname.startsWith("/anime") ||
    pathname.startsWith("/people") ||
    pathname.startsWith("/trending") ||
    pathname.startsWith("/collection") ||
    pathname.startsWith("/browse");
  const isLegalPage =
    pathname.includes("/terms") ||
    pathname.includes("/privacy") ||
    pathname.includes("/cookie-policy") ||
    pathname.includes("/dmca");
  const isWatchlistPage = pathname.includes("/watchlist");
  const isFullPageBackground =
    isSearchPage ||
    isBrowsePage ||
    isLegalPage ||
    isWatchlistPage ||
    isCatalogPage;

  return (
    <>
      <BackgroundImage
        isFullPage={isFullPageBackground}
        imageUrl={imageUrl}
        title={route || title}
        logo={logo}
        hideTitle={hideTitle}
        overlayClassName={
          isWatchlistPage
            ? "bg-black/90"
            : isCatalogPage
              ? "bg-black/80"
              : undefined
        }
      />
    </>
  );
}

// --- carousel-media-dialog.tsx ---
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

// --- carousel-details.tsx ---
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

// --- hero-background.tsx ---
/**
 * Props for the HeroBackground component
 */
interface HeroBackgroundProps {
  /** Media item to display in the background */
  media: MediaItem;
  /** Media type from route (tv or movie) */
  mediaType?: "tv" | "movie";
  /** Whether a video is currently playing */
  isPlayingVideo: boolean;
  /** Whether a trailer is currently playing */
  isPlayingTrailer: boolean;
  /** Animation controls for the background */
  controls: LegacyAnimationControls;
  /** Callback function when trailer ends */
  onTrailerEnded(): void;
  /** YouTube player instance */
  youtubePlayer: YouTubePlayer;
  /** Setter for YouTube player instance */
  setYoutubePlayer(player: YouTubePlayer): void;
  /** Anilist ID for anime content */
  anilistId?: number | null | undefined;
  videasyTrailerUrl: string | null;
  videasyTrailerHlsUrl: string | null;
  videasyTrailerStatus: VideasyTrailerStreamStatus;
  isAmbientMuted: boolean;
  onAmbientAutoplayBlocked(): void;
}

/**
 * HeroBackground component manages the background display for hero sections
 * Handles background images, video playback, and YouTube trailer integration
 * @param props - The component props
 * @returns A dynamic background component with video and image support
 */
export function HeroBackground({
  media,
  mediaType,
  isPlayingVideo,
  isPlayingTrailer,
  controls,
  onTrailerEnded,
  youtubePlayer,
  setYoutubePlayer,
  anilistId,
  videasyTrailerUrl,
  videasyTrailerHlsUrl,
  videasyTrailerStatus,
  isAmbientMuted,
  onAmbientAutoplayBlocked,
}: HeroBackgroundProps) {
  const { getEmbedUrl } = useEpisodeStore();
  const { selectedServer, vidnestContentType, animePreference } =
    useServerStore();
  const initialTrailerVideos = useMemo(() => {
    const rows = extractVideoRowsFromMediaVideos(media.videos).filter(
      (video) =>
        (!video.site || video.site === "YouTube") && Boolean(video.key),
    );
    const primary = selectPrimaryTrailerVideo(rows);
    if (!primary) return rows;
    return [
      primary,
      ...rows.filter((video) => video.key !== primary.key),
    ] as TrailerPickRow[];
  }, [media.videos]);
  const [trailerVideos, setTrailerVideos] =
    useState<TrailerPickRow[]>(initialTrailerVideos);
  const [selectedTrailerIndex, setSelectedTrailerIndex] = useState(0);
  const hasVideasySource =
    videasyTrailerStatus === "ready" &&
    (Boolean(videasyTrailerUrl?.length) ||
      Boolean(videasyTrailerHlsUrl?.length));

  const videasyBackdropReady =
    hasVideasySource && !isPlayingTrailer && !isPlayingVideo;
  const selectedTrailer =
    trailerVideos[selectedTrailerIndex] ?? initialTrailerVideos[0];
  const canSwitchTrailers = trailerVideos.length > 1;

  const getMediaType = (): "movie" | "tv" => {
    if (mediaType) {
      return mediaType;
    }

    if (media) {
      // I found that checking for a 'name' property is a reliable way to identify a TV show.
      // a 'first_air_date' is also a good indicator, as are season and episode counts.
      const isTvShow =
        media.media_type === "tv" ||
        media.name !== undefined ||
        media.first_air_date !== undefined ||
        media.number_of_seasons !== undefined ||
        media.number_of_episodes !== undefined;

      if (isTvShow) {
        return "tv";
      }
    }

    if (typeof window !== "undefined") {
      if (window.location.pathname.includes("/tvshows/")) {
        return "tv";
      } else if (window.location.pathname.includes("/movies/")) {
        return "movie";
      }
    }

    return "movie";
  };

  const getVideoSrc = () => {
    const detectedMediaType = getMediaType();

    if (selectedServer.id === "vidnest" && selectedServer.getVidnestUrl) {
      const episodeStore = useEpisodeStore.getState();

      if (vidnestContentType === "movie") {
        return selectedServer.getVidnestUrl(
          media.id,
          "movie",
          undefined,
          undefined,
          undefined,
        );
      }

      if (vidnestContentType === "tv") {
        if (episodeStore.selectedEpisode) {
          return selectedServer.getVidnestUrl(
            parseInt(episodeStore.tvShowId || ""),
            "tv",
            episodeStore.seasonNumber || undefined,
            episodeStore.selectedEpisode.episode_number,
            undefined,
          );
        }
        return selectedServer.getVidnestUrl(
          media.id,
          "tv",
          undefined,
          undefined,
          undefined,
        );
      }

      if (vidnestContentType === "anime") {
        if (
          episodeStore.isAnimeEpisode &&
          episodeStore.anilistId &&
          episodeStore.relativeEpisodeNumber
        ) {
          return selectedServer.getVidnestUrl(
            media.id,
            "anime",
            undefined,
            episodeStore.relativeEpisodeNumber,
            episodeStore.anilistId,
          );
        } else {
          // For non-anime content with anime content type, use anilistId if available, otherwise construct URL manually
          const episode = episodeStore.selectedEpisode?.episode_number || 1;
          const idToUse = anilistId || media.id;
          return `https://vidnest.fun/anime/${idToUse}/${episode}/${animePreference}`;
        }
      }

      if (vidnestContentType === "animepahe") {
        if (
          episodeStore.isAnimeEpisode &&
          episodeStore.anilistId &&
          episodeStore.relativeEpisodeNumber
        ) {
          return selectedServer.getVidnestUrl(
            media.id,
            "animepahe",
            undefined,
            episodeStore.relativeEpisodeNumber,
            episodeStore.anilistId,
          );
        } else {
          // For non-anime content with animepahe content type, use anilistId if available, otherwise construct URL manually
          const episode = episodeStore.selectedEpisode?.episode_number || 1;
          const idToUse = anilistId || media.id;
          return `https://vidnest.fun/animepahe/${idToUse}/${episode}/${animePreference}`;
        }
      }
    }

    // For TV shows, use episode URLs (which now includes anime URLs)
    if (detectedMediaType === "tv") {
      const episodeEmbedUrl = getEmbedUrl();
      if (episodeEmbedUrl) {
        return episodeEmbedUrl;
      }
      return "";
    }

    // For movies, use movie URL
    return selectedServer.getMovieUrl(media.id);
  };

  const [isAmbientVideoReady, setIsAmbientVideoReady] = useState(false);
  const backdropSrc = `https://image.tmdb.org/t/p/original${
    media.backdrop_path ?? media.poster_path
  }`;
  const ambientVideoKey = hasVideasySource
    ? `${videasyTrailerUrl ?? ""}|${videasyTrailerHlsUrl ?? ""}`
    : media.backdrop_path;
  const shouldShowAmbientVideo = videasyBackdropReady;

  useEffect(() => {
    setTrailerVideos(initialTrailerVideos);
    setSelectedTrailerIndex(0);
  }, [initialTrailerVideos]);

  useEffect(() => {
    setIsAmbientVideoReady(false);
  }, [ambientVideoKey, media.backdrop_path, media.poster_path]);

  useEffect(() => {
    if (!isPlayingTrailer) return;

    let cancelled = false;
    const loadVideos = async () => {
      try {
        const response = await fetch(
          `/api/media/${getMediaType()}/${media.id}/videos`,
        );
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (cancelled) return;
        const rows = extractVideoRowsFromMediaVideos(data).filter(
          (video) =>
            (!video.site || video.site === "YouTube") && Boolean(video.key),
        );
        const primary = selectPrimaryTrailerVideo(rows);
        const sorted = primary
          ? [primary, ...rows.filter((video) => video.key !== primary.key)]
          : rows;
        if (sorted.length > 0) {
          setTrailerVideos(sorted);
          setSelectedTrailerIndex(0);
        }
      } catch {
        // Keep the videos already embedded in the media payload.
      }
    };

    void loadVideos();
    return () => {
      cancelled = true;
    };
  }, [isPlayingTrailer, media.id]);

  useEffect(() => {
    if (!isPlayingTrailer || !selectedTrailer?.key) {
      if (youtubePlayer?.destroy) {
        youtubePlayer.destroy();
        setYoutubePlayer(null);
      }
      return;
    }

    let intervalId: number | null = null;
    let cancelled = false;

    const initPlayer = () => {
      if (cancelled || youtubePlayer || !window.YT?.Player) return;

      try {
        const player = new window.YT.Player("trailer-player", {
          videoId: selectedTrailer.key,
          playerVars: {
            ...HERO_YOUTUBE_CHROMELESS_BASE,
            autoplay: 1,
          },
          events: {
            onStateChange: (event: { data: number }) => {
              if (event.data === 0) {
                onTrailerEnded();
              }
            },
          },
        });
        setYoutubePlayer(player);
      } catch (error) {
        logger.error("Error initializing YouTube player", error);
      }
    };

    if (typeof window !== "undefined") {
      if (window.YT?.Player) {
        initPlayer();
      } else {
        intervalId = window.setInterval(() => {
          if (window.YT?.Player) {
            if (intervalId) {
              window.clearInterval(intervalId);
              intervalId = null;
            }
            initPlayer();
          }
        }, 200);
      }
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (youtubePlayer?.destroy) {
        youtubePlayer.destroy();
        setYoutubePlayer(null);
      }
    };
  }, [
    isPlayingTrailer,
    selectedTrailer?.key,
    onTrailerEnded,
    youtubePlayer,
    setYoutubePlayer,
  ]);

  const switchTrailer = (direction: "next" | "previous") => {
    if (!canSwitchTrailers) return;
    if (youtubePlayer?.destroy) {
      youtubePlayer.destroy();
      setYoutubePlayer(null);
    }
    setSelectedTrailerIndex((current) => {
      const delta = direction === "next" ? 1 : -1;
      return (current + delta + trailerVideos.length) % trailerVideos.length;
    });
  };

  return (
    <div className="absolute inset-0 z-0">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={media.backdrop_path}
          className="relative h-full w-full"
          animate={controls}
        >
          {!isPlayingTrailer && !isPlayingVideo && (
            <motion.img
              src={backdropSrc}
              fetchPriority="high"
              alt={(media.title || media.name) as string}
              className="w-full h-full object-cover absolute inset-0 z-0"
              initial={{ opacity: 0 }}
              animate={{
                opacity: shouldShowAmbientVideo && isAmbientVideoReady ? 0 : 1,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
            />
          )}

          {videasyBackdropReady ? (
            <motion.div
              className="absolute inset-0 z-0 overflow-hidden bg-black/20 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: isAmbientVideoReady ? 1 : 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            >
              <VideasyStreamVideo
                key={`${videasyTrailerUrl ?? ""}|${videasyTrailerHlsUrl ?? ""}`}
                mp4Url={videasyTrailerUrl}
                hlsUrl={videasyTrailerHlsUrl}
                playback="ambient"
                isMuted={isAmbientMuted}
                onAutoplayBlocked={onAmbientAutoplayBlocked}
                onCanPlay={() => setIsAmbientVideoReady(true)}
                className="absolute top-1/2 left-1/2 aspect-video h-[calc(100%+14rem)] min-w-[calc(100%+14rem)] -translate-x-1/2 -translate-y-[calc(50%+25px)] scale-[1.015] object-cover"
              />
            </motion.div>
          ) : null}

          {isPlayingTrailer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full absolute z-30 px-4 sm:px-6 lg:px-8"
              style={{ top: "5rem", height: "calc(100% - 11rem)" }}
            >
              <div className="md:max-w-7xl lg:max-w-8xl mx-auto h-full">
                {selectedTrailer?.key ? (
                  <div className="relative h-full w-full rounded-lg border border-border/20 bg-black shadow-2xl">
                    <div
                      id="trailer-player"
                      key={selectedTrailer.key}
                      className="h-full w-full overflow-hidden rounded-lg"
                    />
                    {canSwitchTrailers ? (
                      <div className="absolute right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2">
                        <button
                          type="button"
                          aria-label="Previous trailer"
                          onClick={() => switchTrailer("previous")}
                          className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75"
                        >
                          <ChevronUp className="size-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label="Next trailer"
                          onClick={() => switchTrailer("next")}
                          className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75"
                        >
                          <ChevronDown className="size-5" aria-hidden />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-lg border border-border/20 bg-black text-sm text-muted-foreground shadow-2xl">
                    Loading trailer...
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {isPlayingVideo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-full absolute z-30 px-4 sm:px-6 lg:px-8"
              style={{ top: "5rem", height: "calc(100% - 11rem)" }}
            >
              <div className="md:max-w-7xl lg:max-w-8xl mx-auto h-full">
                {(() => {
                  const videoSrc = getVideoSrc();
                  const iframeKey = `${videoSrc}-${vidnestContentType}-${animePreference}-${selectedServer.id}`;

                  if (!videoSrc) {
                    return (
                      <div className="w-full h-full rounded-lg overflow-hidden shadow-2xl border border-border/20 bg-black/80 flex items-center justify-center">
                        <div className="text-white text-center">
                          <p>Loading video...</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <motion.iframe
                      key={iframeKey}
                      src={videoSrc}
                      className="w-full h-full rounded-lg overflow-hidden shadow-2xl border border-border/20"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  );
                })()}
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- hero-content.tsx ---
interface HeroContentProps {
  media: MediaItem;
  mediaType?: "tv" | "movie";
  isWatch: boolean;
  isPlayingVideo: boolean;
  isPlayingTrailer: boolean;
  handleWatch(): void;
  handlePlayTrailer(): void;
  handleTrailerEnded(): void;
  youtubePlayer: YouTubePlayer;
  setYoutubePlayer(player: YouTubePlayer): void;
  isUpcoming?: boolean;
  watchlistItem?: WatchlistItem | null;
  initialEpisode?: Episode | null;
  initialSeasonNumber?: number | null;
  canPlayTrailer: boolean;
  showAmbientMuteButton: boolean;
  showAmbientAudioHint: boolean;
  isAmbientMuted: boolean;
  isHeroHovered: boolean;
  onToggleAmbientMute(): void;
}

export function HeroContent({
  media,
  mediaType,
  isWatch,
  isPlayingVideo,
  isPlayingTrailer,
  handleWatch,
  handlePlayTrailer,
  handleTrailerEnded,
  youtubePlayer,
  setYoutubePlayer,
  isUpcoming = false,
  watchlistItem,
  initialEpisode,
  initialSeasonNumber,
  canPlayTrailer,
  showAmbientMuteButton,
  showAmbientAudioHint,
  isAmbientMuted,
  isHeroHovered,
  onToggleAmbientMute,
}: HeroContentProps) {
  const {
    selectedEpisode,
    seasonNumber,
    tvShowId,
    clearSelectedEpisode,
    setWatchCallback,
    setSelectedEpisode,
  } = useEpisodeStore();
  const title = media.title || media.name;

  const year =
    media.release_date?.substring(0, 4) ||
    media.first_air_date?.substring(0, 4);
  const isTv = mediaType === "tv";
  let durationStr: string | null = null;
  if (isTv) {
    if ((media as TvShow).number_of_seasons) {
      const s = (media as TvShow).number_of_seasons;
      durationStr = `${s} Season${s !== 1 ? "s" : ""}`;
    }
  } else {
    const r = (media as Movie).runtime;
    if (r) {
      const h = Math.floor(r / 60);
      const mins = r % 60;
      durationStr = h > 0 ? `${h}h ${mins}m` : `${mins}m`;
    }
  }
  const ratingRaw = media.vote_average;
  const parsedRating = ratingRaw
    ? parseFloat(ratingRaw.toFixed(1)).toString()
    : null;
  const genresArray =
    (media as MediaItem & { genres?: Array<{ name: string }> }).genres
      ?.slice(0, 3)
      .map((genre) => genre.name) || [];
  const primaryProductionCountry =
    !isTv && "production_countries" in media
      ? media.production_countries?.[0]
      : undefined;
  const productionCountryCode = primaryProductionCountry?.iso_3166_1;
  const productionCountryFlag = productionCountryCode
    ? getCountryFlagEmoji(productionCountryCode)
    : null;
  const productionCountryName = primaryProductionCountry
    ? getFriendlyCountryName(
        primaryProductionCountry.iso_3166_1,
        primaryProductionCountry.name,
      )
    : null;

  const metaElements: React.ReactNode[] = [];
  if (parsedRating) {
    metaElements.push(
      <div
        key="rating"
        className="inline-flex h-6 items-center gap-1 text-pink-500"
      >
        <Star className="w-4 h-4 fill-current border-none outline-none focus:outline-none" />
        <span className="text-white/90 text-sm sm:text-base font-medium leading-none tracking-wide">
          {parsedRating}
        </span>
      </div>,
    );
  }
  if (productionCountryCode && productionCountryFlag) {
    metaElements.push(
      <Link
        key="production-country"
        href={`/browse/country/${productionCountryCode.toLowerCase()}?type=movie`}
        className="inline-flex h-6 items-center text-base leading-none transition hover:scale-110 sm:text-lg"
        aria-label={
          productionCountryName
            ? `Browse ${productionCountryName} movies`
            : "Browse movies from this country"
        }
        title={productionCountryName ?? undefined}
      >
        {productionCountryFlag}
      </Link>,
    );
  }
  if (year)
    metaElements.push(
      <span key="year" className="inline-flex h-6 items-center leading-none">
        {year}
      </span>,
    );
  if (durationStr)
    metaElements.push(
      <span
        key="duration"
        className="inline-flex h-6 items-center leading-none"
      >
        {durationStr}
      </span>,
    );
  genresArray.forEach((g: string) =>
    metaElements.push(
      <span key={g} className="inline-flex h-6 items-center leading-none">
        {g}
      </span>,
    ),
  );

  const metaRow = metaElements.reduce<React.ReactNode[]>((acc, curr, i) => {
    if (i === 0) return [curr];
    return [
      ...acc,
      <span
        key={`dot-${i}`}
        className="inline-flex h-6 items-center text-white/50 mx-2 text-sm sm:text-base font-bold leading-none"
      >
        &middot;
      </span>,
      curr,
    ];
  }, [] as React.ReactNode[]);

  // Initialize episode from server-rendered data
  useEffect(() => {
    if (initialEpisode && initialSeasonNumber && mediaType === "tv") {
      const currentSelected = useEpisodeStore.getState().selectedEpisode;
      const currentTvShowId = useEpisodeStore.getState().tvShowId;

      if (!currentSelected || currentTvShowId !== media.id.toString()) {
        setSelectedEpisode(
          initialEpisode,
          media.id.toString(),
          initialSeasonNumber,
          undefined,
          true,
        );
      }
    }
  }, [
    initialEpisode,
    initialSeasonNumber,
    mediaType,
    media.id,
    setSelectedEpisode,
  ]);

  // Use server-rendered episode if available, otherwise use store
  const displayEpisode = selectedEpisode || initialEpisode;
  const displaySeasonNumber = seasonNumber || initialSeasonNumber;

  // Set the watch callback in the episode store
  useEffect(() => {
    if (mediaType === "tv") {
      setWatchCallback(() => {
        handleWatch();
        // Scroll to top to show the video
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }, [handleWatch, mediaType, setWatchCallback]);

  // Clear selected episode when switching to a different TV show or to a movie
  useEffect(() => {
    if (mediaType !== "tv" || (tvShowId && tvShowId !== media.id.toString())) {
      clearSelectedEpisode();
    }
  }, [media.id, mediaType, tvShowId, clearSelectedEpisode]);

  return (
    <div>
      {(isPlayingVideo || isPlayingTrailer) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="absolute z-50 px-4 sm:px-6 lg:px-8 pt-4"
          style={{ top: "calc(100% - 6rem)", left: 0, right: 0 }}
        >
          <div className="md:max-w-7xl lg:max-w-8xl mx-auto flex items-center justify-end gap-3 sm:gap-4">
            <ServerSelector
              media={media}
              mediaType={mediaType}
              onServerSelect={() => {
                if (isPlayingTrailer && youtubePlayer?.destroy) {
                  youtubePlayer.destroy();
                  setYoutubePlayer(null);
                }
                if (isPlayingTrailer) {
                  handleTrailerEnded();
                  handleWatch();
                }
              }}
            />
            <button
              onClick={() => {
                if (isPlayingTrailer && youtubePlayer) {
                  youtubePlayer.destroy();
                  setYoutubePlayer(null);
                }
                handleTrailerEnded();
              }}
              className="group relative bg-background/90 hover:bg-background backdrop-blur-md transition-all duration-200 rounded-full p-2.5 sm:p-3 text-foreground border border-border/50 hover:border-border shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              aria-label={isPlayingTrailer ? "Stop trailer" : "Close video"}
            >
              <X
                size={20}
                className="sm:w-6 sm:h-6 transition-transform duration-200 group-hover:rotate-90"
                strokeWidth={2.5}
              />
            </button>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {!isPlayingVideo && !isPlayingTrailer && (
          <div>
            <motion.div
              className="absolute inset-0 z-20 pointer-events-none flex items-end pb-0 px-4 sm:px-6 lg:px-8"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="relative mx-auto w-full md:max-w-7xl lg:max-w-8xl">
                {isWatch && media.poster_path && (
                  <div className="absolute right-4 top-1/2 z-30 w-24 -translate-y-40 sm:right-6 sm:w-28 lg:hidden">
                    <div className="overflow-hidden rounded-lg border-2 border-white/20 shadow-2xl">
                      <Poster
                        posterPath={media.poster_path}
                        title={(title as string) || "Poster"}
                        size="small"
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    "flex w-full flex-col gap-8 py-12 sm:py-16 lg:gap-8 xl:gap-10",
                    "lg:flex-row lg:items-start",
                  )}
                >
                  <motion.div
                    className={cn(
                      "min-w-0 w-full flex-1 flex flex-col pointer-events-auto rounded-xl",
                      isWatch ? "max-w-3xl" : "max-w-2xl",
                    )}
                    layout
                  >
                    <motion.div layout>
                      {media.logo ? (
                        <MediaLogo
                          logo={media.logo}
                          title={(title as string) || "Logo"}
                          size="default"
                          className={cn(
                            "mb-3 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:mb-4",
                            isHeroHovered ? "size-2/6" : "size-1/4",
                          )}
                        />
                      ) : (
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 drop-shadow-xl tracking-tight">
                          {title as string}
                        </h1>
                      )}
                    </motion.div>

                    <AnimatePresence>
                      {isHeroHovered && (
                        <motion.div
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          variants={{
                            hidden: { opacity: 0, height: 0 },
                            visible: {
                              opacity: 1,
                              height: "auto",
                              transition: {
                                duration: 0.4,
                                ease: [0.19, 1, 0.22, 1], // fluid ease-out
                                staggerChildren: 0.05,
                                delayChildren: 0.05,
                              },
                            },
                            exit: {
                              opacity: 0,
                              height: 0,
                              transition: {
                                duration: 0.3,
                                ease: [0.4, 0, 1, 1], // tight ease-in
                                staggerChildren: 0.03,
                                staggerDirection: -1,
                              },
                            },
                          }}
                          className="overflow-hidden flex flex-col"
                        >
                          {/* Episode Selection Display */}
                          {displayEpisode &&
                            displaySeasonNumber &&
                            mediaType === "tv" && (
                              <motion.div
                                variants={{
                                  hidden: { opacity: 0, y: 15, scale: 0.98 },
                                  visible: {
                                    opacity: 1,
                                    y: 0,
                                    scale: 1,
                                    transition: {
                                      duration: 0.4,
                                      ease: [0.19, 1, 0.22, 1],
                                    },
                                  },
                                  exit: {
                                    opacity: 0,
                                    y: -5,
                                    scale: 0.98,
                                    transition: { duration: 0.2 },
                                  },
                                }}
                                className="mb-4 p-3 bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-lg flex items-center justify-between lg:w-full w-fit"
                              >
                                <div>
                                  <p className="text-primary-foreground font-semibold">
                                    Selected: Season {displaySeasonNumber},
                                    Episode {displayEpisode.episode_number}
                                  </p>
                                  <p className="text-primary-foreground/80 text-sm">
                                    {displayEpisode.name}
                                  </p>
                                </div>
                                <button
                                  onClick={clearSelectedEpisode}
                                  className="ml-4 p-1.5 hover:bg-primary/30 rounded-full transition-colors"
                                  aria-label="Clear episode selection"
                                >
                                  <X
                                    size={16}
                                    className="text-primary-foreground"
                                  />
                                </button>
                              </motion.div>
                            )}

                          <motion.div
                            variants={{
                              hidden: { opacity: 0, x: -10 },
                              visible: {
                                opacity: 1,
                                x: 0,
                                transition: {
                                  duration: 0.4,
                                  ease: [0.19, 1, 0.22, 1],
                                },
                              },
                              exit: {
                                opacity: 0,
                                x: -5,
                                transition: { duration: 0.2 },
                              },
                            }}
                            className="flex items-center flex-wrap text-sm sm:text-base font-medium text-white/90 tracking-wide mb-4 drop-shadow-md"
                          >
                            {metaRow}
                          </motion.div>

                          {media.overview && (
                            <motion.p
                              variants={{
                                hidden: { opacity: 0, y: 15 },
                                visible: {
                                  opacity: 1,
                                  y: 0,
                                  transition: {
                                    duration: 0.4,
                                    ease: [0.19, 1, 0.22, 1],
                                  },
                                },
                                exit: {
                                  opacity: 0,
                                  transition: { duration: 0.2 },
                                },
                              }}
                              className="text-white/80 text-sm sm:text-base max-w-2xl leading-relaxed mb-1 line-clamp-3 drop-shadow-md"
                            >
                              {media.overview}
                            </motion.p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div
                      layout
                      className="flex items-center flex-wrap gap-3 pt-2"
                    >
                      <HeroButtons
                        handleWatch={handleWatch}
                        handlePlayTrailer={handlePlayTrailer}
                        mediaType={mediaType}
                        isUpcoming={isUpcoming}
                        contentId={media.id}
                        watchlistItem={watchlistItem}
                        initialEpisode={initialEpisode}
                        initialSeasonNumber={initialSeasonNumber}
                        canPlayTrailer={canPlayTrailer}
                      />

                      {showAmbientMuteButton && (
                        <div className="relative">
                          <Button
                            variant="chrome"
                            size="icon"
                            onClick={onToggleAmbientMute}
                            className="rounded-full w-10 h-10"
                            aria-label={
                              isAmbientMuted ? "Unmute trailer" : "Mute trailer"
                            }
                          >
                            {isAmbientMuted ? (
                              <VolumeX className="w-4 h-4" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </Button>

                          <AnimatePresence>
                            {showAmbientAudioHint && isAmbientMuted && (
                              <motion.div
                                initial={{
                                  opacity: 0,
                                  scale: 0.94,
                                  x: -6,
                                  filter: "blur(8px)",
                                }}
                                animate={{
                                  opacity: 1,
                                  scale: 1,
                                  x: 0,
                                  filter: "blur(0px)",
                                  transition: {
                                    duration: 0.55,
                                    ease: [0.16, 1, 0.3, 1],
                                  },
                                }}
                                exit={{
                                  opacity: 0,
                                  scale: 0.98,
                                  x: 6,
                                  filter: "blur(6px)",
                                  transition: { duration: 0.24 },
                                }}
                                className="pointer-events-none absolute left-full top-1/2 ml-3 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 bg-black/80 px-3 py-1.5 text-xs font-medium text-white shadow-xl shadow-black/40 backdrop-blur-md"
                              >
                                <span className="text-white/80" aria-hidden>
                                  &larr;
                                </span>
                                <span>Click for audio</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- media-carousel.tsx ---
export function MediaCarousel({ items }: MediaCarouselProps) {
  const [desktopCarouselApi, setDesktopCarouselApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedOverview, setExpandedOverview] = useState<
    Record<number, boolean>
  >({});
  const router = useRouter();

  const getMediaType = (item: (typeof items)[0]) => {
    return match(item)
      .with({ title: P.string }, () => "movie" as const)
      .with({ name: P.string }, () => "tv" as const)
      .otherwise(() => "movie" as const);
  };

  const toggleOverview = (itemId: number) => {
    setExpandedOverview((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  useEffect(() => {
    if (desktopCarouselApi) {
      const onSelect = () => {
        const newIndex = desktopCarouselApi.selectedScrollSnap();
        setCurrentIndex(newIndex);
      };

      desktopCarouselApi.on("select", onSelect);

      const interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          desktopCarouselApi.scrollNext();
        }
      }, 7000);

      return () => {
        desktopCarouselApi.off("select", onSelect);
        clearInterval(interval);
      };
    }

    if (window.innerWidth < 768) {
      const interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
        }
      }, 7000);

      return () => clearInterval(interval);
    }
  }, [desktopCarouselApi, items.length]);

  const handlePosterClick = (index: number) => {
    if (desktopCarouselApi && index !== currentIndex) {
      setCurrentIndex(index);
      desktopCarouselApi.scrollTo(index);
    } else if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  return (
    <>
      <div className="relative hidden md:block">
        <Carousel
          className="w-full h-full"
          setApi={setDesktopCarouselApi}
          plugins={[Fade()]}
          opts={{ loop: true, duration: 50, containScroll: "trimSnaps" }}
        >
          <CarouselContent className="ml-0! h-full">
            {items.map((item, index) => (
              <CarouselItem key={item.id} className="pl-0 h-full">
                <div className="relative w-full h-full z-50">
                  <Image
                    key={`backdrop-${item.id}-${index}`}
                    src={`https://image.tmdb.org/t/p/original${item.backdrop_path}`}
                    alt={match(item)
                      .with({ title: P.string }, (movie) => movie.title)
                      .with({ name: P.string }, (tvShow) => tvShow.name)
                      .otherwise(() => "Media Item")}
                    width={1920}
                    height={1080}
                    priority={index <= 2}
                    className="object-cover brightness-[0.3] z-50 w-full h-full"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute inset-0 bg-linear-to-r from-black/60 to-transparent" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <CarouselDetails
          current={items[currentIndex]}
          items={items}
          onPosterClick={handlePosterClick}
        />

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden md:flex space-x-2 z-10">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => handlePosterClick(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                currentIndex === index ? "w-4 bg-primary" : "bg-white/50"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="relative md:hidden pt-20 pb-4">
        <div className="w-full animate-in fade-in duration-500">
          {(() => {
            const currentItem = items[currentIndex];
            const mediaType = getMediaType(currentItem);
            const genres = getGenreNames(currentItem.genre_ids, mediaType);
            const year = match(currentItem)
              .with({ title: P.string, release_date: P.string }, (movie) =>
                new Date(movie.release_date).getFullYear().toString(),
              )
              .with({ name: P.string, first_air_date: P.string }, (tvShow) =>
                new Date(tvShow.first_air_date).getFullYear().toString(),
              )
              .otherwise(() => "");

            const isExpanded = expandedOverview[currentItem.id] || false;
            const shouldShowReadMore =
              currentItem.overview && currentItem.overview.length > 100;

            return (
              <div className="px-4 w-full">
                <div className="flex gap-4">
                  <div className="shrink-0 w-24 sm:w-28 mt-4">
                    <Poster
                      posterPath={currentItem.poster_path ?? undefined}
                      title={match(currentItem)
                        .with({ title: P.string }, (movie) => movie.title)
                        .with({ name: P.string }, (tvShow) => tvShow.name)
                        .otherwise(() => "Media Item")}
                      size="small"
                      className="rounded-md bg-muted"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-2">
                    <div>
                      <h3 className="text-white text-lg sm:text-xl font-bold mb-2 drop-shadow-lg line-clamp-2">
                        {match(currentItem)
                          .with({ title: P.string }, (movie) => movie.title)
                          .with({ name: P.string }, (tvShow) => tvShow.name)
                          .otherwise(() => "Media Item")}
                      </h3>
                      <div className="flex items-center gap-2 mb-2 text-white/90 text-xs">
                        {currentItem.content_rating && (
                          <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-medium border border-white/30">
                            {currentItem.content_rating}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">
                            {currentItem.vote_average.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3 text-white/80 text-xs flex-wrap">
                        {year && <span>{year}</span>}
                        {year && genres.length > 0 && <span>•</span>}
                        {genres.length > 0 && (
                          <span className="truncate">
                            {genres.slice(0, 2).join(" / ")}
                          </span>
                        )}
                        {mediaType === "tv" &&
                          typeof currentItem.number_of_seasons === "number" &&
                          currentItem.number_of_seasons > 0 && (
                            <>
                              <span>•</span>
                              <span>
                                {currentItem.number_of_seasons} Season
                                {currentItem.number_of_seasons !== 1 ? "s" : ""}
                              </span>
                            </>
                          )}
                      </div>
                      {currentItem.overview && (
                        <div className="mb-2">
                          <p className="text-white/90 text-xs leading-relaxed line-clamp-3">
                            {isExpanded || !shouldShowReadMore
                              ? currentItem.overview
                              : `${currentItem.overview.substring(0, 100)}...`}
                          </p>
                          {shouldShowReadMore && (
                            <button
                              onClick={() => toggleOverview(currentItem.id)}
                              className="text-white/80 text-xs font-medium mt-1 hover:text-orange-400 transition-colors"
                            >
                              {isExpanded ? "Read less" : "Read more"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex justify-center space-x-2 mt-4">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => handlePosterClick(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentIndex === index
                  ? "w-8 bg-white"
                  : "w-2 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        <div className="flex justify-center gap-3 px-4 mt-4">
          <Button
            onClick={() => {
              const current = items[currentIndex];
              const href = match(current)
                .with(
                  { title: P.string, id: P.number },
                  (movie) => `/movies/${movie.id}`,
                )
                .with(
                  { name: P.string, id: P.number },
                  (tvShow) => `/tvshows/${tvShow.id}`,
                )
                .otherwise(() => "#");
              router.push(`${href}?autoplay=true`);
            }}
            size="lg"
            variant="outline"
            className="bg-white/10 backdrop-blur-xs text-white border-white/30 hover:bg-white/20 flex-1"
          >
            <Icons.play className="mr-2 h-4 w-4" />
            Play
          </Button>
          <Button
            onClick={() => {
              const current = items[currentIndex];
              const href = match(current)
                .with(
                  { title: P.string, id: P.number },
                  (movie) => `/movies/${movie.id}`,
                )
                .with(
                  { name: P.string, id: P.number },
                  (tvShow) => `/tvshows/${tvShow.id}`,
                )
                .otherwise(() => "#");
              router.push(href);
            }}
            size="default"
            variant="outline"
            className="bg-white/10 backdrop-blur-xs text-white border-white/30 hover:bg-white/20"
          >
            <Info className="mr-2 h-4 w-4" />
            More Info
          </Button>
        </div>
      </div>
    </>
  );
}

// --- index.tsx ---
interface MediaDetailHeroProps {
  media: MediaItem[];
  noSlide?: boolean;
  isWatch?: boolean;
  mediaType?: "tv" | "movie";
  isUpcoming?: boolean;
  anilistId?: number | null | undefined;
  watchlistItem?: WatchlistItem | null;
  initialEpisode?: Episode | null;
  initialSeasonNumber?: number | null;
  tvHeroEpisodeData?: TvHeroEpisodeData | null;
}

export function MediaDetailHero({
  media,
  noSlide,
  isWatch = false,
  mediaType: passedMediaType,
  isUpcoming = false,
  anilistId,
  watchlistItem,
  initialEpisode,
  initialSeasonNumber,
  tvHeroEpisodeData,
}: MediaDetailHeroProps) {
  const [isAmbientMuted, setIsAmbientMuted] = useState(false);
  const [showAmbientAudioHint, setShowAmbientAudioHint] = useState(false);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [supportsExpandedHero, setSupportsExpandedHero] = useState(false);
  const hoverCollapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (!showAmbientAudioHint) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setShowAmbientAudioHint(false);
    }, 7000);
    return () => window.clearTimeout(timeout);
  }, [showAmbientAudioHint]);

  const {
    currentItemIndex,
    isPlayingVideo,
    isPlayingTrailer,
    youtubePlayer,
    currentItem,
    controls,
    mediaType,
    handleWatch,
    handlePlayTrailer,
    handleTrailerEnded,
    setYoutubePlayer,
    videasyTrailerUrl,
    videasyTrailerHlsUrl,
    videasyTrailerStatus,
    canPlayTrailer,
  } = useMediaHero({ media, noSlide, isWatch, passedMediaType, anilistId });

  const hasVideasyAmbientSource =
    videasyTrailerStatus === "ready" &&
    (Boolean(videasyTrailerUrl?.length) ||
      Boolean(videasyTrailerHlsUrl?.length));
  const showAmbientMuteButton =
    !isPlayingTrailer && !isPlayingVideo && hasVideasyAmbientSource;

  const handleHeroMouseEnter = () => {
    if (hoverCollapseTimeoutRef.current) {
      clearTimeout(hoverCollapseTimeoutRef.current);
      hoverCollapseTimeoutRef.current = null;
    }
    setIsHeroHovered(true);
  };

  const handleHeroMouseLeave = () => {
    if (hoverCollapseTimeoutRef.current) {
      clearTimeout(hoverCollapseTimeoutRef.current);
    }
    hoverCollapseTimeoutRef.current = setTimeout(() => {
      setIsHeroHovered(false);
      hoverCollapseTimeoutRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    const heroExpansionQuery = window.matchMedia("(min-width: 768px)");
    const syncHeroExpansionSupport = () => {
      setSupportsExpandedHero(heroExpansionQuery.matches);
      if (!heroExpansionQuery.matches) {
        setIsHeroHovered(false);
      }
    };

    syncHeroExpansionSupport();
    heroExpansionQuery.addEventListener("change", syncHeroExpansionSupport);

    return () => {
      if (hoverCollapseTimeoutRef.current) {
        clearTimeout(hoverCollapseTimeoutRef.current);
      }
      heroExpansionQuery.removeEventListener(
        "change",
        syncHeroExpansionSupport,
      );
    };
  }, []);

  return (
    <div
      className="relative h-[100svh] min-h-[34rem] overflow-hidden"
      onMouseEnter={handleHeroMouseEnter}
      onMouseLeave={handleHeroMouseLeave}
    >
      <Script src="https://www.youtube.com/iframe_api" strategy="lazyOnload" />

      <HeroBackground
        media={currentItem as MediaItem}
        mediaType={mediaType}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        controls={controls}
        onTrailerEnded={handleTrailerEnded}
        youtubePlayer={youtubePlayer}
        setYoutubePlayer={setYoutubePlayer}
        anilistId={anilistId}
        videasyTrailerUrl={videasyTrailerUrl}
        videasyTrailerHlsUrl={videasyTrailerHlsUrl}
        videasyTrailerStatus={videasyTrailerStatus}
        isAmbientMuted={isAmbientMuted}
        onAmbientAutoplayBlocked={() => {
          setIsAmbientMuted(true);
          setShowAmbientAudioHint(true);
        }}
      />

      <HeroContent
        media={currentItem as MediaItem}
        mediaType={mediaType}
        isWatch={isWatch}
        isPlayingVideo={isPlayingVideo}
        isPlayingTrailer={isPlayingTrailer}
        handleWatch={handleWatch}
        handlePlayTrailer={handlePlayTrailer}
        handleTrailerEnded={handleTrailerEnded}
        youtubePlayer={youtubePlayer}
        setYoutubePlayer={setYoutubePlayer}
        isUpcoming={isUpcoming}
        watchlistItem={watchlistItem}
        initialEpisode={initialEpisode}
        initialSeasonNumber={initialSeasonNumber}
        canPlayTrailer={canPlayTrailer}
        showAmbientMuteButton={showAmbientMuteButton}
        showAmbientAudioHint={showAmbientAudioHint}
        isAmbientMuted={isAmbientMuted}
        isHeroHovered={supportsExpandedHero && isHeroHovered}
        onToggleAmbientMute={() => {
          setShowAmbientAudioHint(false);
          setIsAmbientMuted((prev) => !prev);
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-52 bg-linear-to-b from-transparent via-background/75 to-background sm:h-64 lg:h-80"
      />

      {!noSlide && !isPlayingVideo && !isWatch && media.length > 1 && (
        <HeroPagination items={media} currentIndex={currentItemIndex} />
      )}
    </div>
  );
}
