"use client";

import type { WatchlistItem } from "@/app/watchlist/actions";
import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";
import {
  ContentGrid,
  type ContentItem,
  type ViewMode,
} from "@/components/content-grid";
import { MediaCard } from "@/components/media/media-card";
import { MediaLogo } from "@/components/media/media-logo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { SmartGenreBadgeGroup } from "@/components/ui/genre-badge";
import { useGlobalDock } from "@/components/ui/global-dock";
import { Icons } from "@/lib/icons";
import { useViewModeStore } from "@/lib/stores/view-mode-store";
import type {
  Genre,
  MediaItem,
  Movie,
  ProductionCountry,
} from "@/utils/typings";
import { getAirDate, getTitle, isMovie } from "@/utils/typings";
import { Clock, Star } from "lucide-react";
import Image from "next/legacy/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function ListViewCard(props: {
  item: MediaItem;
  type: MediaItem["media_type"];
}) {
  const { item, type } = props;
  const router = useRouter();

  if (!item.id) {
    return <div>No content ID found</div>;
  }

  const title = getTitle(item);
  const posterPath = item.poster_path ?? undefined;
  const backdropPath = item.backdrop_path ?? undefined;
  const releaseDate = getAirDate(item);
  const voteAverage = item.vote_average;
  const overview = item.overview || "";

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

  const runtime =
    type === "movie" && "runtime" in item
      ? (item as MediaItem & { runtime?: number }).runtime
      : undefined;

  const country = (() => {
    if (
      type === "tv" &&
      "origin_country" in item &&
      item.origin_country?.length
    ) {
      return item.origin_country;
    }
    if (
      type === "movie" &&
      "production_countries" in item &&
      (item as Movie & { production_countries?: ProductionCountry[] })
        .production_countries?.length
    ) {
      return (
        (item as Movie & { production_countries?: ProductionCountry[] })
          .production_countries as ProductionCountry[]
      ).map((pc) => pc.iso_3166_1);
    }
    if ("origin_country" in item && item.origin_country?.length) {
      return item.origin_country;
    }
    return undefined;
  })();

  const itemGenres =
    "genres" in item && Array.isArray(item.genres)
      ? (item.genres as Genre[])
      : undefined;

  const href = isMovie(item)
    ? `/movies/${(item as MediaItem).id}`
    : `/tvshows/${(item as MediaItem).id}`;

  const posterUrl = posterPath
    ? `https://image.tmdb.org/t/p/w500${posterPath}`
    : "/placeholder-poster.jpg";

  const backdropUrl = backdropPath
    ? `https://image.tmdb.org/t/p/w1280${backdropPath}`
    : undefined;

  const handleMouseEnter = () => {
    router.prefetch(href);
  };

  return (
    <Card
      className="group relative overflow-hidden bg-card/40 backdrop-blur-xl border border-white/10 hover:border-primary/50 transition-all duration-500 cursor-pointer shadow-2xl"
      onClick={() => router.push(href)}
      onMouseEnter={handleMouseEnter}
      data-testid={`media-content-card-${item.id}`}
      data-media-type={type}
      data-content-id={item.id}
    >
      {backdropUrl && (
        <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity duration-700">
          <Image
            src={backdropUrl}
            alt=""
            layout="fill"
            objectFit="cover"
            className="blur-sm scale-110"
          />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />

      <div className="relative flex gap-6 p-4 md:p-6">
        <div className="flex-shrink-0 w-24 sm:w-28 md:w-32 lg:w-36">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted shadow-2xl ring-1 ring-white/10 transition-all duration-500">
            <Image
              src={posterUrl}
              alt={title || "Media poster"}
              layout="fill"
              objectFit="cover"
              className="transition-transform duration-700 group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-500 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <Icons.play
                  className="text-primary-foreground w-8 h-8 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                  strokeWidth={1.5}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center space-y-3">
          <div className="space-y-1">
            <MediaLogo
              logo={item.logo}
              title={title}
              align="left"
              className="mb-1 max-w-[240px]"
              fallbackClassName="text-xl sm:text-2xl md:text-3xl font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-300 tracking-tight"
            />
            <div className="flex items-center gap-3 text-sm text-muted-foreground/80 font-medium flex-wrap">
              <span>{formatDate(releaseDate)}</span>

              {voteAverage && voteAverage > 0 && (
                <>
                  <span className="opacity-40">•</span>
                  <div className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-foreground font-semibold">
                      {voteAverage.toFixed(1)}
                    </span>
                  </div>
                </>
              )}

              {item.content_rating && (
                <>
                  <span className="opacity-40">•</span>
                  <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-sm text-[10px] uppercase font-bold">
                    {item.content_rating}
                  </span>
                </>
              )}

              {runtime && (
                <>
                  <span className="opacity-40">•</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>{formatRuntime(runtime)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="secondary"
              className="text-[10px] font-semibold uppercase tracking-widest bg-primary/15 border-primary/20 text-primary px-2 py-0.5 rounded-md"
            >
              {type === "movie" ? "Movie" : "TV Show"}
            </Badge>

            {country && country.length > 0 && (
              <CountryBadge
                country={{ iso_3166_1: country[0], name: country[0] }}
                variant="outline"
                className="text-[10px] bg-white/5 border-white/10 text-white/60 font-semibold uppercase tracking-wider h-5"
                size="sm"
                showName={false}
                mediaType={type as "movie" | "tv"}
              />
            )}

            {itemGenres && itemGenres.length > 0 && (
              <SmartGenreBadgeGroup
                genreIds={itemGenres.map((g) => g.id)}
                mediaType={type as "movie" | "tv"}
                maxVisible={2}
                className="flex gap-2"
                badgeClassName="text-[10px] bg-white/5 text-white/60 border-white/10 font-semibold uppercase tracking-wider h-5 hover:bg-primary/20 hover:text-primary transition-all"
                variant="outline"
              />
            )}
          </div>

          {overview && (
            <p className="hidden sm:block text-sm text-muted-foreground/90 line-clamp-2 md:line-clamp-3 leading-relaxed max-w-2xl font-normal">
              {overview}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

interface MediaContentGridProps {
  /** Optional title to display above the grid */
  title?: string;
  /** Array of media items to display in the grid */
  items: MediaItem[];
  /** Media type for all items in the grid */
  type?: MediaItem["media_type"];
  /** Default view mode (grid or list) */
  defaultViewMode?: ViewMode;
  /** Number of columns for grid layout */
  gridColumns?: "auto" | 1 | 2 | 3 | 4 | 5 | 6;
  /** Additional CSS classes */
  className?: string;
  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void;
  /** Whether to show view mode controls */
  showViewModeControls?: boolean;
  /** Whether to show the animated dock */
  showDock?: boolean;
  /** Position of the dock */
  dockPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Test ID for testing */
  "data-testid"?: string;
  /** Items per row for grid layout */
  itemsPerRow?: number;
  /** Optional map of watchlist items by contentId */
  watchlistItemsMap?: Map<number, WatchlistItem>;
  /** Optional callback for status change */
  onStatusChange?: (
    itemId: string,
    newStatus: "watching" | "waiting" | "finished",
  ) => void;
  /** Optional map of episode info by contentId */
  episodeInfoMap?: Map<number, EpisodeInfo | null>;
}

export function MediaContentGrid({
  title,
  items,
  defaultViewMode,
  gridColumns = 4,
  className,
  onViewModeChange,
  showViewModeControls = true,
  showDock = true,
  dockPosition = "bottom-right",
  "data-testid": testId,
  itemsPerRow = 4,
  type,
  watchlistItemsMap,
  onStatusChange,
  episodeInfoMap,
}: MediaContentGridProps) {
  const {
    viewMode: storedViewMode,
    setViewMode: setStoredViewMode,
    getResponsiveDefault,
  } = useViewModeStore();

  const {
    viewMode: globalViewMode,
    setViewMode: setGlobalViewMode,
    setShowDock,
  } = useGlobalDock();

  const effectiveViewMode = showDock
    ? globalViewMode
    : storedViewMode || defaultViewMode || getResponsiveDefault();

  const handleViewModeChange = (mode: ViewMode) => {
    if (showDock) {
      setGlobalViewMode(mode);
    } else {
      setStoredViewMode(mode);
    }
    onViewModeChange?.(mode);
  };

  useEffect(() => {
    setShowDock(showDock);
  }, [showDock, setShowDock]);

  // Filter out any invalid items (no ID, null, undefined)
  const validItems = items.filter(
    (item) => item && item.id !== null && item.id !== undefined,
  );

  const processedItems = validItems.map((item) => ({
    ...item,
    media_type: type || item.media_type,
  }));

  const renderMediaCard = (item: ContentItem, viewMode: ViewMode) => {
    const mediaItem = item as MediaItem;
    const watchlistItem =
      mediaItem.id && watchlistItemsMap
        ? watchlistItemsMap.get(mediaItem.id)
        : undefined;
    const episodeInfo =
      mediaItem.id && episodeInfoMap
        ? episodeInfoMap.get(mediaItem.id)
        : undefined;

    if (viewMode === "list") {
      return (
        <ListViewCard
          key={`${mediaItem.id}`}
          item={mediaItem}
          type={mediaItem.media_type}
        />
      );
    }

    return (
      <div key={`${mediaItem.id}`} className="w-full">
        <MediaCard
          item={mediaItem}
          type={mediaItem.media_type}
          rating={mediaItem.content_rating || undefined}
          watchlistItem={watchlistItem}
          onStatusChange={onStatusChange}
          episodeInfo={episodeInfo}
        />
      </div>
    );
  };

  return (
    <div
      className="space-y-6"
      data-testid={testId || "media-content-grid-container"}
    >
      {title && (
        <h2
          className="text-2xl font-bold text-foreground"
          data-testid="media-content-grid-title"
        >
          {title}
        </h2>
      )}
      <ContentGrid
        items={processedItems}
        renderCard={renderMediaCard}
        defaultViewMode={effectiveViewMode}
        gridColumns={gridColumns}
        className={className}
        onViewModeChange={handleViewModeChange}
        showViewModeControls={showViewModeControls}
        showDock={false}
        dockPosition={dockPosition}
        data-testid={testId ? `${testId}-grid` : "media-content-grid"}
        itemsPerRow={itemsPerRow}
      />
    </div>
  );
}

export { MediaContentGrid as ContentGrid };
