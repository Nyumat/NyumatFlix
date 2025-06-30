import { buildItemsWithCategories, fetchTMDBData } from "@/app/actions";
import { ContentGrid } from "@/components/content-grid";
import { buildFilterParams, getFilterConfig } from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { LoadMore } from "./load-more";

interface FilteredMovieContentProps {
  filterId?: string;
  genre?: string;
  year?: string;
  director?: string;
  studio?: string;
}

export async function FilteredMovieContent({
  filterId,
  genre,
  year,
  director,
  studio,
}: FilteredMovieContentProps): Promise<JSX.Element> {
  // Determine the filter ID based on the parameters
  let resolvedFilterId = filterId || "";

  // If no filterId provided, try to build one from legacy parameters
  if (!resolvedFilterId) {
    if (genre) {
      // Map genre IDs to filter IDs
      const genreMap: Record<string, string> = {
        "28": "genre-action",
        "35": "genre-comedy",
        "18": "genre-drama",
        "53": "genre-thriller",
        "878,14": "genre-scifi-fantasy",
        "10749,35": "genre-romcom",
      };
      resolvedFilterId = genreMap[genre] || "";
    } else if (year) {
      // Map year ranges to filter IDs
      const yearMap: Record<string, string> = {
        "1980-1989": "year-80s",
        "1990-1999": "year-90s",
        "2000-2009": "year-2000s",
      };
      resolvedFilterId = yearMap[year] || "";
    }
  }

  // Get the filter configuration
  const filterConfig = getFilterConfig(resolvedFilterId);
  const { endpoint, params } = buildFilterParams(resolvedFilterId);

  // Fetch content
  const allMovies: MediaItem[] = [];
  let currentPage = 1;
  const MAX_PAGES = 5;
  const MINIMUM_MOVIES = 20;

  // Track used IDs to avoid duplicates
  const seenIds = new Set<number>();

  while (allMovies.length < MINIMUM_MOVIES && currentPage <= MAX_PAGES) {
    const pageContent = await fetchTMDBData(endpoint, {
      ...params,
      page: currentPage.toString(),
    });

    if (!pageContent.results || pageContent.results.length === 0) {
      break;
    }

    // Filter valid movies (with poster path) and remove duplicates
    const validMovies = pageContent.results.filter((movie: MediaItem) => {
      if (!movie.poster_path) return false;
      if (seenIds.has(movie.id)) return false;
      seenIds.add(movie.id);
      return true;
    });

    allMovies.push(...validMovies);
    currentPage++;

    if (currentPage > (pageContent.total_pages || 1)) {
      break;
    }
  }

  if (allMovies.length === 0) {
    return (
      <div className="p-8 text-center text-white">
        No movies found matching your criteria
      </div>
    );
  }

  // Process the results with categories
  const processedContent = await buildItemsWithCategories<MediaItem>(
    allMovies,
    "movie",
  );

  // Initial offset for pagination
  const initialOffset = currentPage;

  // Get the page title from the filter config or use a default
  const pageTitle = filterConfig?.title || "Movies";

  // Server action for loading more movies
  const getMoreMovies = async (offset: number) => {
    "use server";
    try {
      const response = await fetchTMDBData(endpoint, {
        ...params,
        page: offset.toString(),
      });

      if (!response?.results || response.results.length === 0) {
        return null;
      }

      const processedMovies = await buildItemsWithCategories<MediaItem>(
        response.results,
        "movie",
      );

      const nextOffset =
        offset < (response.total_pages || 0) ? offset + 1 : null;

      return [
        <ContentGrid items={processedMovies} key={offset} type="movie" />,
        nextOffset,
      ] as const;
    } catch (error) {
      console.error("Error loading more movies:", error);
      return null;
    }
  };

  return (
    <>
      <LoadMore
        key={`${resolvedFilterId}-${genre}-${year}`}
        getMovieListNodes={getMoreMovies}
        initialOffset={initialOffset}
      >
        <ContentGrid items={processedContent} type="movie" />
      </LoadMore>
    </>
  );
}
