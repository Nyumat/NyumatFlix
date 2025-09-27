"use client";

import { MultiSelect } from "@/components/multi-select";
import { PeopleInfiniteScroll } from "@/components/search/people-inf-scroll";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { SmartGenreBadgeGroup } from "@/components/ui/genre-badge";
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
import { Clock, Play, Star } from "lucide-react";
import Image from "next/legacy/image";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

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

  // Build href without narrowing item in each branch to avoid TS 'never' issue
  const href = `/${isMovie(item) ? "movies" : "tvshows"}/${item.id}`;

  const posterUrl = posterPath
    ? `https://image.tmdb.org/t/p/w342${posterPath}`
    : "/placeholder-poster.jpg";

  const backdropUrl = backdropPath
    ? `https://image.tmdb.org/t/p/w1280${backdropPath}`
    : undefined;

  const handleMouseEnter = () => {
    router.prefetch(href);
  };

  return (
    <Card
      className="group relative overflow-hidden bg-gradient-to-r from-background/95 via-background/80 to-background/60 backdrop-blur-xl border border-border/30 hover:border-primary/50 transition-all duration-500 cursor-pointer h-full"
      onClick={() => router.push(href)}
      onMouseEnter={handleMouseEnter}
    >
      {backdropUrl && (
        <div className="absolute inset-0 opacity-30 group-hover:opacity-40 transition-opacity duration-500">
          <Image
            src={backdropUrl}
            alt={title || "Media backdrop"}
            layout="fill"
            objectFit="cover"
            className="blur-[6px] scale-110 group-hover:blur-[4px] transition-all duration-500"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-background/40 to-background/30" />
      <div className="relative flex gap-6 p-6 h-full">
        <div className="flex-shrink-0 w-24 sm:w-28 md:w-32 lg:w-36">
          <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted shadow-2xl ring-1 ring-border/20">
            <Image
              src={posterUrl}
              alt={title || "Media poster"}
              layout="fill"
              objectFit="cover"
              className="transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-500 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="flex items-center justify-center w-12 h-12 bg-primary/90 backdrop-blur-sm rounded-full shadow-xl ring-2 ring-primary/20">
                  <Play className="text-primary-foreground w-5 h-5 ml-0.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col py-2">
          <div className="space-y-3">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-300 leading-tight">
                {title}
              </h3>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                <span className="font-medium">{formatDate(releaseDate)}</span>

                {voteAverage && voteAverage > 0 && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold text-yellow-400">
                        {voteAverage.toFixed(1)}
                      </span>
                    </div>
                  </>
                )}

                {runtime && (
                  <>
                    <span>•</span>
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
                className="text-xs font-semibold bg-primary/15 border-primary/30 text-primary px-2 py-1"
              >
                {type === "movie" ? "Movie" : "TV Show"}
              </Badge>

              {country && country.length > 0 && (
                <CountryBadge
                  country={{ iso_3166_1: country[0], name: country[0] }}
                  variant="outline"
                  className="text-xs bg-muted/30 border-border/50 text-muted-foreground"
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
                  className="flex gap-1.5"
                  badgeClassName="text-xs bg-muted/30 text-muted-foreground border-border/50 px-2 py-1"
                  variant="outline"
                />
              )}
            </div>

            {overview && (
              <p className="text-sm text-muted-foreground/90 leading-relaxed">
                {overview}
              </p>
            )}
          </div>
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
      <div className="text-center py-0 text-muted-foreground">
        Loading search results for &quot;{query.trim()}&quot;...
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive text-center py-10">{error}</div>;
  }

  if (!query || !query.trim()) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        Please enter a search query.
      </div>
    );
  }

  if (items.length === 0 && !isLoading) {
    return (
      <div className="text-center py-10 text-muted-foreground">
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
            <div className="space-y-4" data-testid="search-results-grid">
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
