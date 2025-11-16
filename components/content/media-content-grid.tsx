"use client";

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
import { useViewModeStore } from "@/lib/stores/view-mode-store";
import type {
  Genre,
  MediaItem,
  Movie,
  ProductionCountry,
} from "@/utils/typings";
import { getAirDate, getTitle, isMovie } from "@/utils/typings";
import { Clock, Play, Star } from "lucide-react";
import Image from "next/legacy/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { WatchlistItem } from "@/app/watchlist/actions";
import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";

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
      className="group relative overflow-hidden bg-card/50 backdrop-blur-md border border-border/20 hover:border-primary/40 transition-all duration-300 cursor-pointer"
      onClick={() => router.push(href)}
      onMouseEnter={handleMouseEnter}
    >
      {backdropUrl && (
        <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-300">
          <Image
            src={backdropUrl}
            alt=""
            layout="fill"
            objectFit="cover"
            className="blur-sm"
          />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/60 to-transparent" />

      <div className="relative flex gap-4 p-4">
        <div className="flex-shrink-0 w-20 sm:w-24 md:w-28 lg:w-32">
          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
            <Image
              src={posterUrl}
              alt={title || "Media poster"}
              layout="fill"
              objectFit="cover"
              className="transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center justify-center w-8 h-8 bg-primary/90 backdrop-blur-sm rounded-full shadow-lg">
                  <Play className="text-primary-foreground w-4 h-4 ml-0.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <MediaLogo
            logo={item.logo}
            title={title}
            className="mb-2 max-w-[200px]"
            fallbackClassName="text-base sm:text-lg text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-200"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <span>{formatDate(releaseDate)}</span>

            {voteAverage && voteAverage > 0 && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span>{voteAverage.toFixed(1)}</span>
                </div>
              </>
            )}

            {runtime && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatRuntime(runtime)}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-xs bg-primary/10 border-primary/30 text-primary"
            >
              {type === "movie" ? "Movie" : "TV Show"}
            </Badge>

            {country && country.length > 0 && (
              <CountryBadge
                country={{ iso_3166_1: country[0], name: country[0] }}
                variant="outline"
                className="text-xs bg-muted/20 border-border text-muted-foreground"
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
                className="flex gap-1"
                badgeClassName="text-xs bg-muted/20 text-muted-foreground border-border"
                variant="outline"
              />
            )}
          </div>

          {overview && (
            <p className="hidden sm:block text-sm text-muted-foreground line-clamp-2 leading-relaxed">
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

  const processedItems = items.map((item) => ({
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
    <div className="space-y-6">
      {title && <h2 className="text-2xl font-bold text-foreground">{title}</h2>}
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
        data-testid={testId}
        itemsPerRow={itemsPerRow}
      />
    </div>
  );
}

export { MediaContentGrid as ContentGrid };
