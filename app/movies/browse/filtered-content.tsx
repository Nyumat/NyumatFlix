import { buildItemsWithCategories, fetchTMDBData } from "@/app/actions";
import { ContentGrid } from "@/components/content/content-grid";
import { buildFilterParams } from "@/utils/content-filters";
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

  // If no filterId provided, try to build one from legacy parameters
  if (!resolvedFilterId && genre) {
    // Direct genre filtering without needing predefined filters
    endpoint = "/discover/movie";
    params = {
      with_genres: genre,
      language: "en-US",
      include_adult: "false",
      sort_by: "popularity.desc",
    };
  } else if (!resolvedFilterId && year) {
    // Map year ranges to filter IDs
    const yearMap: Record<string, string> = {
      "1980-1989": "year-80s",
      "1990-1999": "year-90s",
      "2000-2009": "year-2000s",
    };
    resolvedFilterId = yearMap[year] || "";
  }

  // If we have a filter ID, use the filter configuration
  if (resolvedFilterId) {
    const filterConfig = buildFilterParams(resolvedFilterId);
    endpoint = filterConfig.endpoint;
    params = filterConfig.params;
  } else if (!endpoint) {
    // Fallback to default if no filter or genre specified
    const filterConfig = buildFilterParams("");
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
