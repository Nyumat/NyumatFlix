import {
  buildItemsWithCategories,
  fetchPaginatedCategory,
  fetchTMDBData,
} from "@/app/actions";
import { ContentGrid } from "@/components/content/media-content-grid";
import { InfiniteScroll } from "@/components/ui/infinite-scroll";
import {
  buildFilterParams,
  createYearFilterParams,
  getFilterConfig,
} from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { getMoreMovies } from "./actions";

interface FilteredMovieContentProps {
  filterId?: string;
  genre?: string;
  year?: string;
}

export async function FilteredMovieContent({
  filterId,
  genre,
  year,
}: FilteredMovieContentProps): Promise<React.JSX.Element> {
  // Determine the filter ID based on the parameters
  const resolvedFilterId = filterId || "";
  let endpoint = "";
  let params: Record<string, string> | { useCustomFetch: true } = {};
  let useCategoryFetching = false;

  // Handle year filtering first
  if (year) {
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
      with_original_language: "en",
    };
  } else if (resolvedFilterId) {
    // Use centralized filter configuration when filterId is provided.
    // If the filter uses a custom fetcher (studios, directors, collections, etc),
    // switch to category-based fetching for both initial load and pagination.
    const filter = getFilterConfig(resolvedFilterId);
    if (filter?.fetchConfig.customFetch) {
      useCategoryFetching = true;
      endpoint = resolvedFilterId; // pass category ID through to load-more
      params = { useCustomFetch: true };
    } else {
      const filterConfig = buildFilterParams(resolvedFilterId);
      endpoint = filterConfig.endpoint;
      params = filterConfig.params;
    }
  } else {
    // Fallback to popular movies if no parameters
    // Use the filter system for consistency
    useCategoryFetching = true;
    endpoint = "popular";
    params = { useCustomFetch: true };
  }

  // Fetch initial page of content
  let initialResults: MediaItem[] = [];

  if (useCategoryFetching) {
    initialResults = await fetchPaginatedCategory(endpoint, "movie", 1);
  } else {
    const initialResponse = await fetchTMDBData(endpoint, {
      ...(params as Record<string, string>),
      page: "1",
    });
    initialResults = (initialResponse?.results as MediaItem[]) || [];
  }

  if (!initialResults || initialResults.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No movies found matching your criteria.
      </div>
    );
  }

  // Filter valid movies (with poster path) for initial load
  const validInitialResults = initialResults.filter((movie: MediaItem) =>
    Boolean(movie.poster_path),
  );

  if (validInitialResults.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No movies found matching your criteria.
      </div>
    );
  }

  // Process the results with categories
  const processedContent = await buildItemsWithCategories<MediaItem>(
    validInitialResults,
    "movie",
  );

  // Initial offset for pagination (start with page 2)
  const initialOffset = 2;

  // Create a bound server action with the current endpoint and params
  const boundGetMoreMovies = getMoreMovies.bind(null, endpoint, params);

  return (
    <InfiniteScroll
      getListNodes={boundGetMoreMovies}
      initialOffset={initialOffset}
      className="space-y-8"
    >
      <ContentGrid items={processedContent} type="movie" />
    </InfiniteScroll>
  );
}
