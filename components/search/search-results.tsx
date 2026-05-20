"use client";

import { MultiSelect } from "@/components/multi-select";
import { HorizontalCard } from "@/components/cards";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { useSearchResults } from "@/hooks/useSearchResults";
import { getStableCardKey } from "@/lib/cards";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/utils/typings";
import { User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

interface KnownForItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  media_type: string;
}

interface PersonCollageProps {
  knownFor?: KnownForItem[];
  profilePath?: string | null;
  className?: string;
}

const getCollageLayout = (
  count: number,
): {
  imagesToShow: number;
  gridCols: string;
  gridRows: string;
  specialLayout?: "three";
} => {
  if (count <= 1) {
    return {
      imagesToShow: 1,
      gridCols: "grid-cols-1",
      gridRows: "grid-rows-1",
    };
  }
  if (count === 2) {
    return {
      imagesToShow: 2,
      gridCols: "grid-cols-2",
      gridRows: "grid-rows-1",
    };
  }
  if (count === 3) {
    return {
      imagesToShow: 3,
      gridCols: "grid-cols-2",
      gridRows: "grid-rows-2",
      specialLayout: "three",
    };
  }
  if (count === 4) {
    return {
      imagesToShow: 4,
      gridCols: "grid-cols-2",
      gridRows: "grid-rows-2",
    };
  }
  if (count > 4 && count <= 10) {
    return {
      imagesToShow: 5,
      gridCols: "grid-cols-3",
      gridRows: "grid-rows-2",
    };
  }
  return { imagesToShow: 10, gridCols: "grid-cols-4", gridRows: "grid-rows-3" };
};

export function PersonCollage({
  knownFor = [],
  profilePath,
  className,
}: PersonCollageProps) {
  const hasKnownFor = knownFor.length > 0;
  const { imagesToShow, gridCols, gridRows, specialLayout } = getCollageLayout(
    hasKnownFor ? knownFor.length : 0,
  );

  if (profilePath) {
    return (
      <div className={cn("w-full h-full relative", className)}>
        <Image
          src={`https://image.tmdb.org/t/p/w185${profilePath}`}
          fill
          sizes="(max-width: 768px) 45vw, (max-width: 1200px) 20vw, 120px"
          alt="Profile"
          className="rounded-md object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  if (!hasKnownFor) {
    return (
      <div
        className={cn(
          "w-full h-full flex items-center justify-center text-muted-foreground bg-muted",
          className,
        )}
      >
        <User size={32} />
      </div>
    );
  }

  const imagesToDisplay = knownFor.slice(0, imagesToShow);

  if (specialLayout === "three") {
    return (
      <div
        className={cn(
          "w-full h-full grid gap-0.5 rounded-md overflow-hidden",
          gridCols,
          gridRows,
          className,
        )}
      >
        {imagesToDisplay.map((item, index) => {
          const isFirstImage = index === 0;
          return (
            <div
              key={`${item.id}-${index}`}
              className={cn(
                "relative w-full h-full",
                isFirstImage && "col-span-2",
              )}
            >
              {item.poster_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w154${item.poster_path}`}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  alt={item.title || item.name || "Media"}
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <User size={16} className="text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full h-full grid gap-0.5 rounded-md overflow-hidden",
        gridCols,
        gridRows,
        className,
      )}
    >
      {imagesToDisplay.map((item, index) => (
        <div key={`${item.id}-${index}`} className="relative w-full h-full">
          {item.poster_path ? (
            <Image
              src={`https://image.tmdb.org/t/p/w154${item.poster_path}`}
              fill
              sizes="(max-width: 768px) 45vw, (max-width: 1200px) 20vw, 120px"
              alt={item.title || item.name || "Media"}
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <User size={16} className="text-muted-foreground" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface Person {
  id: number;
  name: string;
  profile_path?: string | null;
  popularity?: number;
  known_for_department?: string;
  known_for?: KnownForItem[];
}

interface PeopleInfiniteScrollProps {
  query: string;
}

export function PeopleInfiniteScroll({ query }: PeopleInfiniteScrollProps) {
  const router = useRouter();
  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const [people, setPeople] = useState<Person[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(false);

  const { ref: sentinelRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: "100px",
  });

  useEffect(() => {
    setPeople([]);
    setCurrentPage(1);
    setTotalPages(1);
    setError(null);
    initialLoadRef.current = false;
  }, [trimmedQuery]);

  const fetchPage = useCallback(
    async (page: number) => {
      if (!trimmedQuery) return { results: [], page: 1, total_pages: 0 };

      const url = new URL("/api/person-search", window.location.origin);
      url.searchParams.set("query", trimmedQuery);
      url.searchParams.set("page", String(page));

      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || "Failed to fetch people");
      }

      const json = (await res.json()) as {
        results: Person[];
        page: number;
        total_pages: number;
        total_results: number;
      };

      return {
        results: json.results || [],
        page: json.page || page,
        total_pages: json.total_pages || 0,
      };
    },
    [trimmedQuery],
  );

  const loadInitial = useCallback(async () => {
    if (initialLoadRef.current || isLoading || !trimmedQuery) return;
    initialLoadRef.current = true;

    try {
      setIsLoading(true);
      const { results, page, total_pages } = await fetchPage(1);
      setPeople(results);
      setCurrentPage(page);
      setTotalPages(total_pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [fetchPage, isLoading, trimmedQuery]);

  const loadMore = useCallback(async () => {
    if (isLoading || currentPage >= totalPages) return;

    try {
      setIsLoading(true);
      const nextPage = currentPage + 1;
      const { results, page, total_pages } = await fetchPage(nextPage);
      setPeople((prev) => [...prev, ...results]);
      setCurrentPage(page);
      setTotalPages(total_pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, fetchPage, isLoading, totalPages]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (inView && !isLoading && currentPage < totalPages) {
      void loadMore();
    }
  }, [inView, isLoading, currentPage, totalPages, loadMore]);

  const handlePersonClick = (personId: number) => {
    router.push(`/person/${personId}`);
  };

  if (!trimmedQuery) return null;

  if (error) {
    return (
      <div className="bg-card/50 backdrop-blur-xs border border-border/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">People</h4>
        <div className="text-xs text-destructive">{error}</div>
      </div>
    );
  }

  if (people.length === 0 && isLoading) {
    return (
      <div className="bg-card/50 backdrop-blur-xs border border-border/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-foreground mb-3">People</h4>
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (people.length === 0) return null;

  return (
    <div className="bg-card/50 backdrop-blur-xs border border-border/50 rounded-lg overflow-hidden">
      <div className="p-4 pb-2 border-b border-border/50">
        <h4 className="text-sm font-medium text-foreground">People</h4>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="p-4 pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
            {people.map((person) => (
              <button
                key={`person-${person.id}`}
                onClick={() => handlePersonClick(person.id)}
                className="group text-left w-full focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-md"
                aria-label={`View ${person.name}`}
              >
                <div className="rounded-md overflow-hidden aspect-3/4 bg-muted relative group-hover:ring-2 group-hover:ring-primary/50 transition-all duration-300">
                  <PersonCollage
                    knownFor={person.known_for}
                    profilePath={person.profile_path}
                    className="group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
                <div className="mt-2 space-y-0.5">
                  <p className="text-xs font-medium text-foreground/90 line-clamp-1 group-hover:text-primary transition-colors">
                    {person.name}
                  </p>
                  {person.known_for_department && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {person.known_for_department}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {currentPage < totalPages && (
            <>
              <div ref={sentinelRef} className="h-8 mt-3" aria-hidden />
              {isLoading && (
                <div className="text-center py-2">
                  <span className="text-xs text-muted-foreground">
                    Loading more...
                  </span>
                </div>
              )}
            </>
          )}

          {currentPage >= totalPages && people.length > 0 && (
            <div className="text-center py-2 mt-3">
              <span className="text-xs text-muted-foreground">
                End of results
              </span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

const isValidMediaItem = (item: {
  poster_path?: string | null;
  backdrop_path?: string | null;
}): boolean => {
  return Boolean(item.poster_path || item.backdrop_path);
};

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
            key={page === "ellipsis" ? `ellipsis-${index}` : `page-${page}`}
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

export default function SearchResults({
  query,
  hideTitle = false,
  hidePaginationInfo = false,
}: {
  query: string;
  hideTitle?: boolean;
  hidePaginationInfo?: boolean;
}) {
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
              className="bg-card/50 backdrop-blur-xs border border-border/50 rounded-lg p-4"
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
                className="backdrop-blur-md bg-white/10 border-white/30 text-white hover:bg-white/20 hover:border-white/40 shadow-lg focus:ring-0 focus:ring-offset-0 [&_span]:text-white [&_svg]:text-white/80 [&_svg:hover]:text-white"
                data-testid="genre-multi-select"
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-9 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            {!hideTitle && (
              <h2
                className="text-lg md:text-xl font-medium text-primary-foreground"
                data-testid="search-results-title"
              >
                Results for "{query}"
              </h2>
            )}
            {!hidePaginationInfo && (
              <div
                className={cn(
                  "text-xs text-muted-foreground",
                  hideTitle && "sm:ml-auto",
                )}
                data-testid="pagination-info"
              >
                {totalPages > 1 && (
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                )}
              </div>
            )}
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
                .map((item) => (
                  <HorizontalCard
                    key={getStableCardKey(item)}
                    item={{
                      ...item,
                      genres:
                        item.genres ??
                        item.genre_ids
                          ?.map((id) => ({ id, name: allGenres[id] }))
                          .filter((genre) => genre.name && genre.id),
                    }}
                    testIdPrefix="search-result-card"
                  />
                ))}
            </div>
          </div>
          <ScrollToTop />
        </div>
      </div>
    </div>
  );
}
