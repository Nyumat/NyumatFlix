import {
  buildItemsWithCategories,
  enrichItemsWithContentRatings,
  fetchPaginatedCategory,
  fetchTMDBData,
} from "@/app/actions";
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
  const resolvedFilterId = filterId || "";
  let endpoint = "";
  let params: Record<string, string> | { useCustomFetch: true } = {};
  let useCategoryFetching = false;

  if (year) {
    const yearFilterConfig = createYearFilterParams(year, "movie");
    endpoint = yearFilterConfig.endpoint;
    params = yearFilterConfig.params;
  } else if (genre) {
    endpoint = "/discover/movie";
    params = {
      with_genres: genre,
      language: "en-US",
      include_adult: "false",
      sort_by: "popularity.desc",
      with_original_language: "en",
    };
  } else if (resolvedFilterId) {
    const filter = getFilterConfig(resolvedFilterId);
    if (filter?.fetchConfig.customFetch) {
      useCategoryFetching = true;
      endpoint = resolvedFilterId;
      params = { useCustomFetch: true };
    } else {
      const filterConfig = buildFilterParams(resolvedFilterId);
      endpoint = filterConfig.endpoint;
      params = filterConfig.params;
    }
  } else {
    useCategoryFetching = true;
    endpoint = "popular";
    params = { useCustomFetch: true };
  }

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

  const processedContent = await buildItemsWithCategories<MediaItem>(
    validInitialResults,
    "movie",
  );

  const processedContentWithRatings = await enrichItemsWithContentRatings(
    processedContent,
    "movie",
  );

  const initialOffset = 2;

  const initialSeenIds = processedContentWithRatings
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number");

  const boundGetMoreMovies = getMoreMovies.bind(null, endpoint, params);

  return (
    <InfiniteScroll
      getListNodes={boundGetMoreMovies}
      initialOffset={initialOffset}
      className="space-y-8"
      initialSeenIds={initialSeenIds}
      unifiedGrid={true}
      initialItems={processedContentWithRatings}
      gridType="movie"
    />
  );
}
