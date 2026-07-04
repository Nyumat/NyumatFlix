"use client";

import { MultiSelect } from "@/components/multi-select";
import { HorizontalCard } from "@/components/cards/horizontal-card";
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
import { getStableCardKey } from "@/lib/cards/selectors";
import { cn } from "@/lib/utils";
import type { CanonicalMediaCard } from "@/lib/domain/typings";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { PersonCollage } from "./person-collage";
import { SearchDialogPeople } from "./search-dialog-people";
import { SearchGenreChips } from "./search-genre-chips";

interface KnownForItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  media_type: string;
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
        <h3 className="text-sm font-medium text-foreground mb-3">People</h3>
        <div className="text-xs text-destructive">{error}</div>
      </div>
    );
  }

  if (people.length === 0 && isLoading) {
    return (
      <div className="bg-card/50 backdrop-blur-xs border border-border/50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">People</h3>
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (people.length === 0) return null;

  return (
    <div className="bg-card/50 backdrop-blur-xs border border-border/50 rounded-lg overflow-hidden">
      <div className="p-4 pb-2 border-b border-border/50">
        <h3 className="text-sm font-medium text-foreground">People</h3>
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

const filterItemsByGenre = (
  items: CanonicalMediaCard[],
  selectedGenreIds: string[],
) => {
  if (selectedGenreIds.length === 0) return items;
  return items.filter((item) =>
    item.genre_ids?.some((genreId) =>
      selectedGenreIds.includes(genreId.toString()),
    ),
  );
};

export default function SearchResults({
  query,
  hideTitle = false,
  hidePaginationInfo = false,
  variant = "page",
  onNavigate,
}: {
  query: string;
  hideTitle?: boolean;
  hidePaginationInfo?: boolean;
  variant?: "page" | "dialog";
  onNavigate?: () => void;
}) {
  const isDialogLayout = variant === "dialog" || hideTitle;

  const {
    items,
    currentPage,
    totalPages,
    isLoading,
    isFetching,
    error,
    selectedGenreIds,
    allGenres,
    genresLoading,
    filteredItems,
    genreOptions,
    setCurrentPage,
    setSelectedGenreIds,
  } = useSearchResults(query);

  const [accumulatedItems, setAccumulatedItems] = useState<
    CanonicalMediaCard[]
  >([]);
  const trimmedQuery = query.trim();

  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
    threshold: 0,
    rootMargin: "160px",
  });

  useEffect(() => {
    if (!isDialogLayout) return;
    setAccumulatedItems([]);
    setCurrentPage(1);
  }, [trimmedQuery, isDialogLayout, setCurrentPage]);

  useEffect(() => {
    if (!isDialogLayout) return;

    if (currentPage === 1) {
      setAccumulatedItems(items);
      return;
    }

    setAccumulatedItems((previousItems) => {
      const existingKeys = new Set(previousItems.map(getStableCardKey));
      const nextItems = items.filter(
        (item) => !existingKeys.has(getStableCardKey(item)),
      );
      return [...previousItems, ...nextItems];
    });
  }, [items, currentPage, isDialogLayout]);

  const dialogFilteredItems = useMemo(
    () => filterItemsByGenre(accumulatedItems, selectedGenreIds),
    [accumulatedItems, selectedGenreIds],
  );

  const pageFilteredItems = filteredItems;
  const visibleItems = isDialogLayout ? dialogFilteredItems : pageFilteredItems;

  const parsedGenresForFilter = useMemo(() => genreOptions, [genreOptions]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const loadMoreResults = useCallback(() => {
    if (isFetching || currentPage >= totalPages) return;
    setCurrentPage(currentPage + 1);
  }, [currentPage, isFetching, setCurrentPage, totalPages]);

  useEffect(() => {
    if (!isDialogLayout) return;
    if (loadMoreInView && !isFetching && currentPage < totalPages) {
      loadMoreResults();
    }
  }, [
    currentPage,
    isDialogLayout,
    isFetching,
    loadMoreInView,
    loadMoreResults,
    totalPages,
  ]);

  if (
    isLoading &&
    items.length === 0 &&
    accumulatedItems.length === 0 &&
    query &&
    query.trim()
  ) {
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

  if (
    items.length === 0 &&
    !isLoading &&
    !isFetching &&
    accumulatedItems.length === 0
  ) {
    return (
      <div
        className="text-center py-10 text-muted-foreground"
        data-testid="search-results-no-results"
      >
        No results found for &quot;{query.trim()}&quot;.
      </div>
    );
  }

  const genreFilterPanel =
    !genresLoading && parsedGenresForFilter.length > 0 ? (
      isDialogLayout ? (
        <SearchGenreChips
          options={parsedGenresForFilter}
          selectedIds={selectedGenreIds}
          onChange={setSelectedGenreIds}
        />
      ) : (
        <div
          className="bg-card/50 backdrop-blur-xs border border-border/50 rounded-lg p-4"
          data-testid="genre-filter"
        >
          <h3 className="text-sm font-medium text-foreground mb-3">
            Filter by Genre
          </h3>
          <MultiSelect
            options={parsedGenresForFilter}
            maxCount={3}
            onValueChange={(selectedIds) => {
              setSelectedGenreIds(selectedIds);
            }}
            placeholder="Select genres..."
            defaultValue={selectedGenreIds}
            className="min-h-10 h-auto w-full rounded-full border-white/30 bg-white/10 px-1 shadow-lg backdrop-blur-md hover:border-white/40 hover:bg-white/20 focus:ring-0 focus:ring-offset-0 [&_span]:text-white [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-white/80 [&_svg:hover]:text-white"
            data-testid="genre-multi-select"
          />
        </div>
      )
    ) : null;

  if (isDialogLayout) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0c0c0e]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex min-h-0 flex-col lg:flex-row">
            <aside className="shrink-0 border-b border-white/8 bg-white/[0.02] lg:w-56 lg:border-b-0 lg:border-r xl:w-60">
              <div className="space-y-5 p-4">
                {genreFilterPanel}
                <div className="hidden lg:block">
                  <SearchDialogPeople query={query} onNavigate={onNavigate} />
                </div>
              </div>
            </aside>

            <section className="min-w-0 flex-1">
              <div className="border-b border-white/8 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {visibleItems.filter(isValidMediaItem).length}
                  </span>{" "}
                  titles
                </p>
              </div>

              <div
                className="space-y-2 p-3 sm:p-4"
                data-testid="search-results-list"
              >
                {visibleItems
                  .filter((item) => isValidMediaItem(item))
                  .map((item) => (
                    <HorizontalCard
                      key={getStableCardKey(item)}
                      onNavigate={onNavigate}
                      variant="compact"
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

              {currentPage < totalPages ? (
                <div
                  className="border-t border-white/8 px-4 py-3"
                  data-testid="search-load-more"
                >
                  <div ref={loadMoreRef} className="h-1" aria-hidden />
                  {isFetching ? (
                    <p className="py-1 text-center text-xs text-muted-foreground">
                      Loading more...
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          <div className="border-t border-white/8 p-4 lg:hidden">
            <SearchDialogPeople query={query} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-2 pb-8 sm:px-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-3">
          <PeopleInfiniteScroll query={query} />
          {genreFilterPanel}
        </div>

        <div className="flex flex-col lg:col-span-9">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {!hideTitle && (
              <h2
                className="text-lg font-medium text-primary-foreground md:text-xl"
                data-testid="search-results-title"
              >
                Results for "{query}"
              </h2>
            )}
            {!hidePaginationInfo && (
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
            )}
          </div>

          <EnhancedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />

          <div className="mt-4">
            <div className="space-y-4" data-testid="search-results-list">
              {pageFilteredItems
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
