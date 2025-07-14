import { buildItemsWithCategories, fetchTMDBData } from "@/app/actions";
import { ContentGrid } from "@/components/content/media-content-grid";
import {
  buildFilterParams,
  createYearFilterParams,
  generateYearFilterId,
} from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { getMoreMovies } from "./actions";
import { LoadMore } from "./load-more";

interface FilteredMovieContentProps {
  filterId?: string;
  genre?: string;
  year?: string;
}

export async function FilteredMovieContent({
  filterId,
  genre,
  year,
}: FilteredMovieContentProps): Promise<JSX.Element> {
  // Determine the filter ID based on the parameters
  let resolvedFilterId = filterId || "";
  let endpoint = "";
  let params: Record<string, string> = {};

  // Handle year filtering first
  if (year) {
    // Try to find predefined year filter first
    const yearFilterId = generateYearFilterId(year, "movie");
    const yearFilterConfig = createYearFilterParams(year, "movie");
    endpoint = yearFilterConfig.endpoint;
    params = yearFilterConfig.params;
  } else if (genre) {
    // Direct genre filtering without needing predefined filters
    endpoint = "/discover/movie";
    params = {
      with_genres: genre,
      language: "en-US",
      include_adult: "false",
      sort_by: "popularity.desc",
    };
  } else if (resolvedFilterId) {
    // Use the filter configuration if filterId is provided
    const filterConfig = buildFilterParams(resolvedFilterId);
    endpoint = filterConfig.endpoint;
    params = filterConfig.params;
  } else {
    // Fallback to popular movies if no parameters
    const filterConfig = buildFilterParams("popular");
    endpoint = filterConfig.endpoint;
    params = filterConfig.params;
  }

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
      <div className="p-8 text-center text-muted-foreground">
        No movies found matching your criteria.
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

  // Create a bound server action with the current endpoint and params
  const boundGetMoreMovies = getMoreMovies.bind(null, endpoint, params);

  return (
    <>
      <LoadMore
        key={`${resolvedFilterId}-${genre}-${year}`}
        getMovieListNodes={boundGetMoreMovies}
        initialOffset={initialOffset}
      >
        <ContentGrid items={processedContent} type="movie" />
      </LoadMore>
    </>
  );
}
