"use client";

import { MediaLogo } from "@/components/media/media-display";
import { PrimaryGenreBadge } from "@/components/media/controls/genre-badge";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MediaItem } from "@/lib/domain/typings";
import { cn } from "@/lib/utils";
import { Calendar, Clock, DollarSign, Star } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { BackgroundImageProps, HeroProps } from "./types";

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
                priority
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
    pathname === "/live" ||
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
  );
}
