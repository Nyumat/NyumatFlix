import { getMovies, MovieCategory } from "@/app/actions";
import { ContentGrid } from "@/components/content-grid";
import { LoadMore } from "./load-more";

interface ICProps {
  type: MovieCategory;
}

export async function InfiniteContent({ type }: ICProps): Promise<JSX.Element> {
  const initialMovies = await getMovies(type, 1);
  if (!initialMovies?.results) return <div>No movies found</div>;
  const initialOffset = 2;
  const getMovieListNodes = async (offset: number) => {
    "use server";
    try {
      const response = await getMovies(type, offset);

      if (!response?.results) {
        return null;
      }

      const nextOffset =
        offset < (response.total_pages || 0) ? offset + 1 : null;

      return [
        <ContentGrid items={response.results} key={offset} />,
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
      <ContentGrid items={initialMovies.results} />
    </LoadMore>
  );
}
