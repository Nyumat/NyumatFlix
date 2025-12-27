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
  let endpoint = "";
  let params: Record<string, string> | { useCustomFetch: true } = {};
  let useCategoryFetching = false;

  if (year) {
    const yearFilterConfig = createYearFilterParams(year, "tv");
    endpoint = yearFilterConfig.endpoint;
    params = yearFilterConfig.params;
  } else if (genre) {
    endpoint = "/discover/tv";
    params = {
      with_genres: genre,
      language: "en-US",
      include_adult: "false",
      sort_by: "popularity.desc",
    };
  } else if (filterId) {
    const filter = getFilterConfig(filterId);
    if (filter?.fetchConfig.customFetch) {
      useCategoryFetching = true;
      endpoint = filterId;
      params = { useCustomFetch: true };
    } else {
      const filterConfig = buildFilterParams(filterId);
      endpoint = filterConfig.endpoint;
      params = filterConfig.params;
    }
  } else {
    useCategoryFetching = true;
    endpoint = "tv-popular";
    params = { useCustomFetch: true };
  }

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

  const processedShows = await buildItemsWithCategories<MediaItem>(
    validInitialResults,
    "tv",
  );

  const initialOffset = 2;

  const initialSeenIds = processedShows
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number");

  const getTVShowListNodes = async (
    offset: number,
    seenIds?: number[],
  ): Promise<
    readonly [React.JSX.Element, number | null, MediaItem[] | undefined] | null
  > => {
    "use server";
    try {
      const seenIdsSet = new Set(seenIds || []);
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

      const validResults = pageResults.filter((item: MediaItem) =>
        Boolean(item.poster_path),
      );
      if (validResults.length === 0) return null;

      const processedShows = await buildItemsWithCategories<MediaItem>(
        validResults,
        "tv",
      );

      const uniqueShows = processedShows.filter((item) => {
        if (typeof item.id !== "number") return true;
        if (seenIdsSet.has(item.id)) return false;
        return true;
      });

      if (uniqueShows.length === 0) {
        const nextOffset = useCategoryFetching
          ? validResults.length > 0
            ? offset + 1
            : null
          : offset < 1000 && offset < 100
            ? offset + 1
            : null;
        if (nextOffset) {
          return getTVShowListNodes(nextOffset, seenIds);
        }
        return null;
      }

      const nextOffset = useCategoryFetching
        ? validResults.length > 0
          ? offset + 1
          : null
        : offset < 1000
          ? offset + 1
          : null;

      return [
        <ContentGrid
          items={uniqueShows}
          key={offset}
          type="tv"
          showViewModeControls={false}
        />,
        nextOffset,
        uniqueShows,
      ] as const;
    } catch (error) {
      console.error("Error loading more TV shows:", error);
      return null;
    }
  };

  return (
    <InfiniteScroll
      getListNodes={getTVShowListNodes}
      initialOffset={initialOffset}
      className="space-y-8"
      initialSeenIds={initialSeenIds}
      unifiedGrid={true}
      initialItems={processedShows}
      gridType="tv"
      gridItemsPerRow={4}
    />
  );
}
