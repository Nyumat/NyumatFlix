"use client";

import { MediaContentGrid } from "@/components/content/media-content-grid";
import { MultiSelect } from "@/components/multi-select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useSearchResults } from "@/hooks/useSearchResults";
import type { MediaItem, Movie, TvShow } from "@/utils/typings";
import { useMemo } from "react";

const isValidMediaItem = (item: Movie | TvShow): boolean => {
  return Boolean(item.poster_path || item.backdrop_path);
};

/**
 * Enhanced Pagination Component using shadcn components
 */
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
  // Don't render if there's only one page or no pages
  if (totalPages <= 1) return null;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 7; // Maximum number of page buttons to show

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 4) {
        // Near the beginning
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Near the end
        pages.push("ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          if (i > 1) pages.push(i);
        }
      } else {
        // In the middle
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
    <Pagination className="mt-8">
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
                ? "pointer-events-none opacity-50"
                : "cursor-pointer"
            }
          />
        </PaginationItem>

        {pageNumbers.map((page, index) => (
          <PaginationItem key={index}>
            {page === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(page);
                }}
                isActive={currentPage === page}
                className="cursor-pointer"
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
                ? "pointer-events-none opacity-50"
                : "cursor-pointer"
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

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (isLoading && items.length === 0 && query && query.trim()) {
    return (
      <div className="text-center py-10 text-muted-foreground">
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

  const parsedGenresForFilter = useMemo(() => genreOptions, [genreOptions]);

  return (
    <div className="container mx-auto px-2 sm:px-4 pb-12">
      <div className="flex justify-end items-center mb-6">
        {!genresLoading && parsedGenresForFilter.length > 0 && (
          <div
            className="w-full md:w-64 max-w-sm rounded-lg overflow-hidden shadow-xl bg-black/30 backdrop-blur-md border border-white/20"
            data-testid="genre-filter"
          >
            <MultiSelect
              options={parsedGenresForFilter}
              maxCount={3}
              onValueChange={(selectedIds) => {
                setSelectedGenreIds(selectedIds);
              }}
              placeholder="Filter by Genre"
              defaultValue={selectedGenreIds}
              className="border-none focus:ring-0 focus:ring-offset-0"
              data-testid="genre-multi-select"
            />
          </div>
        )}
      </div>

      {/* Page info */}
      <div className="flex justify-between items-center mb-6">
        <h2
          className="text-2xl md:text-3xl font-semibold text-primary-foreground"
          data-testid="search-results-title"
        >
          Search Results for "{query}"
        </h2>
        <div
          className="text-sm text-muted-foreground"
          data-testid="pagination-info"
        >
          {totalPages > 1 && (
            <span>
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>
      </div>

      <MediaContentGrid
        items={filteredItems.filter(isValidMediaItem).map((item) => {
          const mediaType = "title" in item ? "movie" : "tv";
          return {
            ...item,
            genres: item.genre_ids
              ?.map((id) => ({ id, name: allGenres[id] }))
              .filter((g) => g.name && g.id),
            media_type: mediaType,
          } as MediaItem;
        })}
        defaultViewMode="list"
        data-testid="search-results-grid"
      />

      {/* Enhanced Pagination */}
      <EnhancedPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        data-testid="search-pagination"
      />
    </div>
  );
}
