import { buildItemsWithCategories, getMovies } from "@/app/actions";
import { ContentGrid } from "@/components/content/media-content-grid";
import { MovieCategory } from "@/utils/typings";
import { LoadMore } from "./load-more";

interface ICProps {
  type: MovieCategory;
}

export async function InfiniteContent({ type }: ICProps): Promise<JSX.Element> {
  const initialMoviesResponse = await getMovies(type, 1);
  if (!initialMoviesResponse?.results) return <div>No movies found</div>;

  // Transform the raw results into MediaItem[]
  const initialMovies = await buildItemsWithCategories(
    initialMoviesResponse.results,
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

      // Transform the raw results into MediaItem[]
      const processedMovies = await buildItemsWithCategories(
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
    <LoadMore
      key={type}
      getMovieListNodes={getMovieListNodes}
      initialOffset={initialOffset}
    >
      <ContentGrid items={initialMovies} type="movie" />
    </LoadMore>
  );
}
