"use client";

import { useSearchResults } from "@/hooks/useSearchResults";
import { getStableCardKey } from "@/lib/cards/selectors";
import type { CanonicalMediaCard } from "@/lib/domain/typings";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";
import { SearchDialogResultsLayout } from "./search-dialog-layout";
import { SearchGenreChips } from "./search-genre-chips";
import { SearchResultsSkeleton } from "./search-results-skeleton";
import { SearchTypeTabs, type SearchContentFilter } from "./search-type-tabs";

const isValidMediaItem = (item: {
  poster_path?: string | null;
  backdrop_path?: string | null;
}): boolean => {
  return Boolean(item.poster_path || item.backdrop_path);
};

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

const filterItemsByMediaType = (
  items: CanonicalMediaCard[],
  contentFilter: SearchContentFilter,
) => {
  if (contentFilter === "all" || contentFilter === "person") return items;
  return items.filter((item) => item.media_type === contentFilter);
};

export default function SearchResults({
  query,
  hideTitle = false,
  onNavigate,
}: {
  query: string;
  hideTitle?: boolean;
  onNavigate?: () => void;
}) {
  const [contentFilter, setContentFilter] =
    useState<SearchContentFilter>("all");

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
    genreOptions,
    setCurrentPage,
    setSelectedGenreIds,
  } = useSearchResults(query);

  const [accumulatedItems, setAccumulatedItems] = useState<
    CanonicalMediaCard[]
  >([]);

  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({
    threshold: 0,
    rootMargin: "160px",
  });

  useEffect(() => {
    setContentFilter("all");
  }, [query]);

  useEffect(() => {
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
  }, [items, currentPage]);

  const filteredItems = useMemo(() => {
    const genreFiltered = filterItemsByGenre(
      accumulatedItems,
      selectedGenreIds,
    );
    return filterItemsByMediaType(genreFiltered, contentFilter);
  }, [accumulatedItems, selectedGenreIds, contentFilter]);

  const validMediaItems = filteredItems.filter(isValidMediaItem);

  const loadMoreResults = useCallback(() => {
    if (isFetching || currentPage >= totalPages) return;
    setCurrentPage(currentPage + 1);
  }, [currentPage, isFetching, setCurrentPage, totalPages]);

  useEffect(() => {
    if (loadMoreInView && !isFetching && currentPage < totalPages) {
      loadMoreResults();
    }
  }, [currentPage, isFetching, loadMoreInView, loadMoreResults, totalPages]);

  const genreFilterPanel =
    !genresLoading && genreOptions.length > 0 ? (
      <SearchGenreChips
        options={genreOptions}
        selectedIds={selectedGenreIds}
        onChange={setSelectedGenreIds}
        layout="scroll"
        showHeader={false}
      />
    ) : null;

  const showMediaResults =
    contentFilter === "all" ||
    contentFilter === "movie" ||
    contentFilter === "tv";
  const showPeopleResults =
    contentFilter === "all" || contentFilter === "person";

  if (
    isLoading &&
    items.length === 0 &&
    accumulatedItems.length === 0 &&
    query &&
    query.trim()
  ) {
    return (
      <div data-testid="search-results-loading">
        <SearchResultsSkeleton count={5} variant="row" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-8 text-center text-destructive"
        data-testid="search-results-error"
      >
        <p className="text-sm font-medium">Search failed</p>
        <p className="mt-1 text-xs opacity-90">{error}</p>
      </div>
    );
  }

  if (!query || !query.trim()) {
    return (
      <div
        className="py-10 text-center text-muted-foreground"
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
    accumulatedItems.length === 0 &&
    contentFilter !== "person"
  ) {
    return (
      <div
        className="py-10 text-center text-muted-foreground"
        data-testid="search-results-no-results"
      >
        No results found for &quot;{query.trim()}&quot;.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!hideTitle ? (
          <h2
            className="text-lg font-medium text-primary-foreground md:text-xl"
            data-testid="search-results-title"
          >
            Results for &quot;{query}&quot;
          </h2>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <SearchTypeTabs value={contentFilter} onChange={setContentFilter} />
        </div>
      </div>

      <SearchDialogResultsLayout
        query={query}
        contentFilter={contentFilter}
        validMediaItems={validMediaItems}
        allGenres={allGenres}
        genreFilterPanel={genreFilterPanel}
        showMediaResults={showMediaResults}
        showPeopleResults={showPeopleResults}
        isFetching={isFetching}
        currentPage={currentPage}
        totalPages={totalPages}
        loadMoreRef={loadMoreRef}
        onNavigate={onNavigate}
      />
    </div>
  );
}
