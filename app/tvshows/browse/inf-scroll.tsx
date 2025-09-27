import {
  buildItemsWithCategories,
  fetchPaginatedCategory,
  fetchTMDBData,
} from "@/app/actions";
import { ContentGrid } from "@/components/content/media-content-grid";
import {
  buildFilterParams,
  createYearFilterParams,
  getFilterConfig,
} from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { LoadMore } from "./load-more";

interface ICProps {
  filterId: string;
  genre?: string;
  year?: string;
}

export async function InfiniteContent({
  filterId,
  genre,
  year,
}: ICProps): Promise<React.JSX.Element> {
  // Determine the endpoint and params based on the parameters
  let endpoint = "";
  let params: Record<string, string> | { useCustomFetch: true } = {};
  let useCategoryFetching = false;

  // Handle year filtering first
  if (year) {
    const yearFilterConfig = createYearFilterParams(year, "tv");
    endpoint = yearFilterConfig.endpoint;
    params = yearFilterConfig.params;
  } else if (genre) {
    // If genre is provided and no filterId, use direct genre filtering
    endpoint = "/discover/tv";
    params = {
      with_genres: genre,
      language: "en-US",
      include_adult: "false",
      sort_by: "popularity.desc",
    };
  } else if (filterId) {
    // Use centralized filter configuration when filterId is provided
    const filter = getFilterConfig(filterId);
    if (filter?.fetchConfig.customFetch) {
      useCategoryFetching = true;
      endpoint = filterId; // pass category ID through for pagination
      params = { useCustomFetch: true };
    } else {
      const filterConfig = buildFilterParams(filterId);
      endpoint = filterConfig.endpoint;
      params = filterConfig.params;
    }
  } else {
    // Default to popular TV shows if no parameters using filter system
    useCategoryFetching = true;
    endpoint = "tv-popular";
    params = { useCustomFetch: true };
  }

  // Fetch initial TV shows
  let initialResults: MediaItem[] = [];
  if (useCategoryFetching) {
    initialResults = await fetchPaginatedCategory(endpoint, "tv", 1);
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
        No TV shows found matching your criteria.
      </div>
    );
  }

  // Filter out items without poster_path for consistency
  const validInitialResults = initialResults.filter((item: MediaItem) =>
    Boolean(item.poster_path),
  );

  if (validInitialResults.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No TV shows found matching your criteria.
      </div>
    );
  }

  // Process the results with categories
  const processedShows = await buildItemsWithCategories<MediaItem>(
    validInitialResults,
    "tv",
  );

  const initialOffset = 2;

  // Get the page title from the filter config or use a default
  // const pageTitle = filterConfig?.title || "TV Shows";

  const getTVShowListNodes = async (offset: number) => {
    "use server";
    try {
      let pageResults: MediaItem[] = [];

      if (useCategoryFetching) {
        pageResults = await fetchPaginatedCategory(endpoint, "tv", offset);
      } else {
        const response = await fetchTMDBData(endpoint, {
          ...(params as Record<string, string>),
          page: offset.toString(),
        });
        pageResults = (response?.results as MediaItem[]) || [];
        if (!response?.results || response.results.length === 0) return null;
      }

      // Filter out items without poster_path to match initial load behavior
      const validResults = pageResults.filter((item: MediaItem) =>
        Boolean(item.poster_path),
      );
      if (validResults.length === 0) return null;

      const processedShows = await buildItemsWithCategories<MediaItem>(
        validResults,
        "tv",
      );

      // For category fetching, we don't know total pages; keep going while results appear
      const nextOffset = useCategoryFetching
        ? validResults.length > 0
          ? offset + 1
          : null
        : offset < 1000 // fallback safety if API omits total_pages
          ? offset + 1
          : null;

      return [
        <ContentGrid
          items={processedShows}
          key={offset}
          type="tv"
          showViewModeControls={false}
        />,
        nextOffset,
      ] as const;
    } catch (error) {
      console.error("Error loading more TV shows:", error);
      return null;
    }
  };

  return (
    <>
      <LoadMore
        key={`${filterId}-${genre}-${year}`}
        getTVShowListNodes={getTVShowListNodes}
        initialOffset={initialOffset}
      >
        <ContentGrid items={processedShows} type="tv" />
      </LoadMore>
    </>
  );
}
