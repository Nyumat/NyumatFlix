import { buildItemsWithCategories, getMovies } from "@/app/actions";
import { ContentGrid } from "@/components/content/media-content-grid";
import { MediaItem, MovieCategory } from "@/utils/typings";
import { LoadMore } from "./load-more";

interface ICProps {
  type: MovieCategory;
}

export async function InfiniteContent({
  type,
}: ICProps): Promise<React.JSX.Element> {
  const initialMoviesResponse = await getMovies(type, 1);
  if (!initialMoviesResponse?.results) return <div>No movies found</div>;

  // Filter out items without poster_path for consistency
  const validInitialResults = initialMoviesResponse.results.filter(
    (item): item is MediaItem => Boolean(item.poster_path),
  );

  if (validInitialResults.length === 0) return <div>No movies found</div>;

  // Transform the raw results into MediaItem[]
  const initialMovies = await buildItemsWithCategories(
    validInitialResults,
    "movie",
  );

  const initialOffset = 2;
  const getMovieListNodes = async (offset: number) => {
    "use server";
    try {
      const response = await getMovies(type, offset);

      if (!response?.results) {
        return null;
      }

      // Filter out items without poster_path to match initial load behavior
      const validResults = response.results.filter((item): item is MediaItem =>
        Boolean(item.poster_path),
      );

      if (validResults.length === 0) {
        return null;
      }

      // Transform the raw results into MediaItem[]
      const processedMovies = await buildItemsWithCategories(
        validResults,
        "movie",
      );

      const nextOffset =
        offset < (response.total_pages || 0) ? offset + 1 : null;

      return [
        <ContentGrid
          items={processedMovies}
          key={offset}
          type="movie"
          showViewModeControls={false}
        />,
        nextOffset,
      ] as const;
    } catch (error) {
      console.error("Error loading more movies:", error);
      return null;
    }
  };

  return (
    <LoadMore
      key={type}
      getListNodes={getMovieListNodes}
      initialOffset={initialOffset}
    >
      <ContentGrid items={initialMovies} type="movie" />
    </LoadMore>
  );
}
