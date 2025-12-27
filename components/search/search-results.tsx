"use client";

import { MultiSelect } from "@/components/multi-select";
import { PeopleInfiniteScroll } from "@/components/search/people-inf-scroll";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { SmartGenreBadgeGroup } from "@/components/ui/genre-badge";
import { MediaLogo } from "../media/media-logo";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { useSearchResults } from "@/hooks/useSearchResults";
import type {
  Genre,
  MediaItem,
  Movie,
  ProductionCountry,
  TvShow,
} from "@/utils/typings";
import { getAirDate, getTitle, isMovie } from "@/utils/typings";
import { Icons } from "@/lib/icons";
import { Clock, Star } from "lucide-react";
import Image from "next/legacy/image";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Poster } from "../media/media-poster";

const isValidMediaItem = (item: Movie | TvShow): boolean => {
  return Boolean(item.poster_path || item.backdrop_path);
};

function SearchResultCard({ item }: { item: MediaItem }) {
  const router = useRouter();

  if (!item?.id) {
    return <div>No content ID found</div>;
  }

  const title = getTitle(item);
  const posterPath = item.poster_path ?? undefined;
  const backdropPath = item.backdrop_path ?? undefined;
  const releaseDate = getAirDate(item);
  const voteAverage = item.vote_average;
  const overview = item.overview || "";
  const type = item.media_type;

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

  const href = `/${isMovie(item) ? "movies" : "tvshows"}/${item.id}`;

  const backdropUrl = backdropPath
    ? `https://image.tmdb.org/t/p/w1280${backdropPath}`
    : undefined;

  const handleMouseEnter = () => {
    router.prefetch(href);
  };

  return (
    <Card
      className="group relative overflow-hidden bg-card/40 backdrop-blur-xl border border-white/10 hover:border-primary/50 transition-all duration-500 cursor-pointer shadow-2xl h-full"
      onClick={() => router.push(href)}
      onMouseEnter={handleMouseEnter}
      data-testid={`search-result-card-${item.id}`}
      data-media-type={item.media_type}
      data-content-id={item.id}
    >
      {backdropUrl && (
        <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity duration-700">
          <Image
            src={backdropUrl}
            alt={title || "Media backdrop"}
            layout="fill"
            objectFit="cover"
            className="blur-sm scale-110"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent pointer-events-none" />
      <div className="relative flex gap-6 p-4 md:p-6 h-full">
        <div className="flex-shrink-0 w-24 sm:w-28 md:w-32 lg:w-36">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted shadow-2xl ring-1 ring-white/10 group-hover:ring-primary/30 transition-all duration-500">
            <Poster
              posterPath={posterPath}
              title={title || "Media poster"}
              size="medium"
              className="transition-transform duration-700 group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-500 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-75 group-hover:scale-100 transition-transform">
                <Icons.play
                  className="text-primary-foreground w-12 h-12 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                  strokeWidth={1.5}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center py-2 space-y-3">
          <div className="space-y-1">
            <MediaLogo
              logo={item.logo}
              title={title}
              align="left"
              className="mb-1 max-w-[240px]"
              fallbackClassName="text-xl sm:text-2xl md:text-3xl font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-300 leading-tight tracking-tight"
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
                maxVisible={3}
                className="flex gap-2"
                badgeClassName="text-[10px] bg-white/5 text-white/60 border-white/10 font-semibold uppercase tracking-wider h-5 hover:bg-primary/20 hover:text-primary transition-all"
                variant="outline"
              />
            )}
          </div>

          {overview && (
            <p className="text-sm text-muted-foreground/90 leading-relaxed line-clamp-2 md:line-clamp-3 max-w-2xl font-normal">
              {overview}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

interface EnhancedPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function EnhancedPagination({
  currentPage,
  totalPages,
  onPageChange,
}: EnhancedPaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage <= 4) {
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push("ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          if (i > 1) pages.push(i);
        }
      } else {
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (currentPage > 1) {
                onPageChange(currentPage - 1);
              }
            }}
            className={
              currentPage === 1
                ? "pointer-events-none opacity-50 h-8 px-2 text-sm"
                : "cursor-pointer h-8 px-2 text-sm"
            }
            data-testid="pagination-previous"
            aria-label="Previous page"
          />
        </PaginationItem>

        {pageNumbers.map((page, index) => (
          <PaginationItem
            key={
              page === "ellipsis"
                ? crypto.randomUUID()
                : `page-${page}-${crypto.randomUUID()}`
            }
          >
            {page === "ellipsis" ? (
              <PaginationEllipsis className="h-8 w-8" />
            ) : (
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(page);
                }}
                isActive={currentPage === page}
                className="cursor-pointer h-8 w-8 text-sm"
                data-testid={`pagination-page-${page}`}
                aria-label={`Go to page ${page}`}
              >
                {page}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (currentPage < totalPages) {
                onPageChange(currentPage + 1);
              }
            }}
            className={
              currentPage === totalPages
                ? "pointer-events-none opacity-50 h-8 px-2 text-sm"
                : "cursor-pointer h-8 px-2 text-sm"
            }
            data-testid="pagination-next"
            aria-label="Next page"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export default function SearchResults({ query }: { query: string }) {
  const {
    items,
    currentPage,
    totalPages,
    isLoading,
    error,
    selectedGenreIds,
    allGenres,
    genresLoading,
    filteredItems,
    genreOptions,
    setCurrentPage,
    setSelectedGenreIds,
  } = useSearchResults(query);

  const parsedGenresForFilter = useMemo(() => genreOptions, [genreOptions]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  if (isLoading && items.length === 0 && query && query.trim()) {
    return (
      <div
        className="text-center py-0 text-muted-foreground"
        data-testid="search-results-loading"
      >
        Loading search results for &quot;{query.trim()}&quot;...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="text-destructive text-center py-10"
        data-testid="search-results-error"
      >
        {error}
      </div>
    );
  }

  if (!query || !query.trim()) {
    return (
      <div
        className="text-center py-10 text-muted-foreground"
        data-testid="search-results-empty-query"
      >
        Please enter a search query.
      </div>
    );
  }

  if (items.length === 0 && !isLoading) {
    return (
      <div
        className="text-center py-10 text-muted-foreground"
        data-testid="search-results-no-results"
      >
        No results found for &quot;{query.trim()}&quot;.
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 pb-8 max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <PeopleInfiniteScroll query={query} />

          {!genresLoading && parsedGenresForFilter.length > 0 && (
            <div
              className="bg-card/50 backdrop-blur-sm border rounded-lg p-4"
              data-testid="genre-filter"
            >
              <h4 className="text-sm font-medium text-foreground mb-3">
                Filter by Genre
              </h4>
              <MultiSelect
                options={parsedGenresForFilter}
                maxCount={3}
                onValueChange={(selectedIds) => {
                  setSelectedGenreIds(selectedIds);
                }}
                placeholder="Select genres..."
                defaultValue={selectedGenreIds}
                className="border-none focus:ring-0 focus:ring-offset-0"
                data-testid="genre-multi-select"
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-9 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <h2
              className="text-lg md:text-xl font-medium text-primary-foreground"
              data-testid="search-results-title"
            >
              Results for "{query}"
            </h2>
            <div
              className="text-xs text-muted-foreground"
              data-testid="pagination-info"
            >
              {totalPages > 1 && (
                <span>
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>
          </div>

          <EnhancedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            data-testid="search-pagination"
          />

          <div className="mt-4">
            <div className="space-y-4" data-testid="search-results-list">
              {filteredItems
                .filter((item) => isValidMediaItem(item))
                .map((item) => {
                  const mediaType = "title" in item ? "movie" : "tv";
                  const enhancedItem: MediaItem = {
                    ...item,
                    genres: item.genre_ids
                      ?.map((id) => ({ id, name: allGenres[id] }))
                      .filter((g) => g.name && g.id),
                    media_type: mediaType,
                  };
                  return (
                    <SearchResultCard
                      key={`${enhancedItem.id}-${mediaType}-${crypto.randomUUID()}`}
                      item={enhancedItem}
                    />
                  );
                })}
            </div>
          </div>
          <ScrollToTop />
        </div>
      </div>
    </div>
  );
}
