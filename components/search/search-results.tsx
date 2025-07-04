"use client";

import { MediaCard } from "@/components/media/media-card";
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
import { cn } from "@/lib/utils";
import {
  Genre as GenreType,
  Movie,
  TmdbResponse,
  TvShow,
} from "@/utils/typings";
import { useEffect, useState } from "react";

const isValidMediaItem = (item: Movie | TvShow): boolean => {
  return Boolean(item.poster_path || item.backdrop_path);
};

// Extend Movie and TvShow types to include the recommendation flag
type MediaItemWithRecommendation = (Movie | TvShow) & {
  isRecommendation?: boolean;
};

interface ContentGridProps {
  title: string;
  items: Array<MediaItemWithRecommendation>;
  currentPage: number;
  totalPages: number;
  genres: { [key: number]: string };
}

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

export function ContentGrid({
  title,
  items,
  currentPage,
  totalPages,
  genres,
}: ContentGridProps) {
  // Items to display
  const displayItems = items;

  // Map our items to the format expected by MediaCard and filter out invalid items
  const processedItems = displayItems.filter(isValidMediaItem).map((item) => {
    const mediaType = "title" in item ? "movie" : "tv";
    return {
      ...item,
      genres: item.genre_ids
        ?.map((id) => ({ id, name: genres[id] }))
        .filter((g) => g.name && g.id),
      media_type: mediaType,
    };
  });

  return (
    <div className="container mx-auto px-4 py-8" data-testid="content-grid">
      <div className="flex justify-between items-center mb-6">
        <h2 className={cn("text-3xl font-semibold", "text-primary-foreground")}>
          {title}
        </h2>
        <div className="text-sm text-muted-foreground">
          {totalPages > 1 && (
            <span>
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {processedItems.map((item) => {
          const itemType = item.media_type === "movie" ? "movie" : "tv";

          return (
            <div
              key={`${item.id}-${itemType}`}
              className={cn(
                "rounded-lg transition-all duration-300 transform hover:scale-105",
              )}
            >
              <MediaCard item={item} type={itemType} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SearchResults({ query }: { query: string }) {
  const [items, setItems] = useState<Array<Movie | TvShow>>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);

  const [allGenres, setAllGenres] = useState<{ [key: number]: string }>({});
  const [genresLoading, setGenresLoading] = useState(true);

  // Filter items by selected genres
  const filteredItems =
    selectedGenreIds.length > 0
      ? items.filter((item) =>
          item.genre_ids?.some((genreId) =>
            selectedGenreIds.includes(genreId.toString()),
          ),
        )
      : items;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    const fetchAllGenres = async () => {
      setGenresLoading(true);
      try {
        const movieGenresRes = await fetch("/api/genres?type=movie");
        const tvGenresRes = await fetch("/api/genres?type=tv");

        if (!movieGenresRes.ok || !tvGenresRes.ok) {
          throw new Error("Failed to fetch genres");
        }

        const movieGenresData = await movieGenresRes.json();
        const tvGenresData = await tvGenresRes.json();

        const combinedGenres: { [key: number]: string } = {};

        // Add null checks to handle potential undefined genres
        if (
          movieGenresData &&
          movieGenresData.genres &&
          Array.isArray(movieGenresData.genres)
        ) {
          movieGenresData.genres.forEach((genre: GenreType) => {
            if (genre && genre.id) {
              combinedGenres[genre.id] = genre.name;
            }
          });
        }

        if (
          tvGenresData &&
          tvGenresData.genres &&
          Array.isArray(tvGenresData.genres)
        ) {
          tvGenresData.genres.forEach((genre: GenreType) => {
            if (genre && genre.id && !combinedGenres[genre.id]) {
              combinedGenres[genre.id] = genre.name;
            }
          });
        }

        setAllGenres(combinedGenres);
      } catch (err: unknown) {
        console.error("Error fetching genres:", err);
        // Set empty object as fallback
        setAllGenres({});
      } finally {
        setGenresLoading(false);
      }
    };
    fetchAllGenres();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!query || !query.trim()) {
        setItems([]);
        setTotalPages(1);
        setCurrentPage(1);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const url = new URL("/api/search", window.location.origin);
        url.searchParams.append("query", query.trim());
        url.searchParams.append("page", currentPage.toString());

        const response = await fetch(url.toString());
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error ||
              `Failed to fetch search results: ${response.statusText}`,
          );
        }
        const searchResults: TmdbResponse<Movie | TvShow> =
          await response.json();

        setItems(searchResults.results || []);
        setTotalPages(searchResults.total_pages || 1);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(
            err.message || "An unknown error occurred while fetching results.",
          );
        } else {
          setError("An unknown error occurred while fetching results.");
        }
        setItems([]);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [query, currentPage]);

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

  const parsedGenresForFilter = Object.entries(allGenres).map(([id, name]) => ({
    label: name,
    value: id,
  }));

  return (
    <div className="container mx-auto px-4">
      <div className="flex justify-end items-center mb-6">
        {!genresLoading && parsedGenresForFilter.length > 0 && (
          <div
            className="w-full md:w-64 max-w-sm rounded-lg overflow-hidden shadow-lg bg-background/80 backdrop-blur-sm border border-accent/20"
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
            />
          </div>
        )}
      </div>

      <ContentGrid
        title={`Search Results for "${query}"`}
        items={filteredItems}
        currentPage={currentPage}
        totalPages={totalPages}
        genres={allGenres}
      />

      {/* Enhanced Pagination */}
      <EnhancedPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
