import { buildItemsWithCategories, getMovies } from "@/app/actions";
import { ContentGrid } from "@/components/content/media-content-grid";
import { InfiniteScroll } from "@/components/ui/infinite-scroll";
import { MediaItem, MovieCategory } from "@/utils/typings";

interface ICProps {
  type: MovieCategory;
}

export async function InfiniteContent({
  type,
}: ICProps): Promise<React.JSX.Element> {
  const initialMoviesResponse = await getMovies(type, 1);
  if (!initialMoviesResponse?.results) return <div>No movies found</div>;

  const validInitialResults = initialMoviesResponse.results.filter(
    (item): item is MediaItem => Boolean(item.poster_path),
  );

  if (validInitialResults.length === 0) return <div>No movies found</div>;

  const initialMovies = await buildItemsWithCategories(
    validInitialResults,
    "movie",
  );

  const initialOffset = 2;
  const initialSeenIds = initialMovies
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number");

  const getMovieListNodes = async (
    offset: number,
    seenIds?: number[],
  ): Promise<
    readonly [React.JSX.Element, number | null, MediaItem[] | undefined] | null
  > => {
    "use server";
    try {
      const seenIdsSet = new Set(seenIds || []);
      const response = await getMovies(type, offset);

      if (!response?.results) {
        return null;
      }

      const validResults = response.results.filter((item): item is MediaItem =>
        Boolean(item.poster_path),
      );

      if (validResults.length === 0) {
        return null;
      }

      const processedMovies = await buildItemsWithCategories(
        validResults,
        "movie",
      );

      const uniqueMovies = processedMovies.filter((item) => {
        if (typeof item.id !== "number") return true;
        if (seenIdsSet.has(item.id)) return false;
        return true;
      });

      if (uniqueMovies.length === 0) {
        const nextOffset =
          offset < (response.total_pages || 0) ? offset + 1 : null;
        if (nextOffset) {
          if (offset < (response.total_pages || 0) && offset < 100) {
            return getMovieListNodes(nextOffset, seenIds);
          }
        }
        return null;
      }

      const nextOffset =
        offset < (response.total_pages || 0) ? offset + 1 : null;

      return [
        <ContentGrid
          items={uniqueMovies}
          key={offset}
          type="movie"
          showViewModeControls={false}
        />,
        nextOffset,
        uniqueMovies,
      ] as const;
    } catch (error) {
      console.error("Error loading more movies:", error);
      return null;
    }
  };

  return (
    <InfiniteScroll
      getListNodes={getMovieListNodes}
      initialOffset={initialOffset}
      className="space-y-8"
      initialSeenIds={initialSeenIds}
      unifiedGrid={true}
      initialItems={initialMovies}
      gridType="movie"
    />
  );
}
