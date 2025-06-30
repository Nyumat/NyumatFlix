"use client";

import { cn } from "@/lib/utils";
import {
  Genre as GenreType,
  Movie,
  TmdbResponse,
  TvShow,
} from "@/utils/typings";
import { useEffect, useState } from "react";
import { MediaCard } from "./media-card";
import { MultiSelect } from "./multi-select";
import { Button } from "./ui/button";

// Helper function to validate media items
const isValidMediaItem = (item: Movie | TvShow): boolean => {
  // Check if the item has either a poster_path or backdrop_path
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
  onPageChange: (page: number) => void;
  genres: { [key: number]: string };
}

export function ContentGrid({
  title,
  items,
  currentPage,
  totalPages,
  onPageChange,
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {processedItems.map((item) => {
          const itemType = item.media_type === "movie" ? "movie" : "tv";

          return (
            <div
              key={`${item.id}-${itemType}`}
              className={cn(
                "rounded-lg transition-all duration-300",
                "hover:scale-102",
              )}
            >
              <MediaCard item={item} type={itemType} />
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-8">
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
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
      if (!query) {
        setItems([]);
        setTotalPages(1);
        setCurrentPage(1);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const url = new URL("/api/search", window.location.origin);
        url.searchParams.append("query", query);
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

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (isLoading && items.length === 0 && query) {
    return (
      <div className="text-center py-10">
        Loading search results for &quot;{query}&quot;...
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-center py-10">{error}</div>;
  }

  if (!query) {
    return (
      <div className="text-center py-10">Please enter a search query.</div>
    );
  }

  if (items.length === 0 && !isLoading) {
    return (
      <div className="text-center py-10">
        No results found for &quot;{query}&quot;.
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
        onPageChange={handlePageChange}
        genres={allGenres}
      />
    </div>
  );
}
