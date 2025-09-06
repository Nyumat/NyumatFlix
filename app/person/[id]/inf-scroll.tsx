import {
  buildItemsWithCategories,
  fetchPersonFilmography,
} from "@/app/actions";
import { LoadMore } from "@/app/movies/browse/load-more";
import { ContentGrid } from "@/components/content/media-content-grid";

function isValidMediaData(
  item: unknown,
): item is { id: number; genre_ids?: number[] } {
  return (
    typeof item === "object" &&
    item !== null &&
    "id" in item &&
    typeof (item as { id: unknown }).id === "number"
  );
}

interface PersonInfiniteContentProps {
  personId: number;
}

export async function PersonInfiniteContent({
  personId,
}: PersonInfiniteContentProps): Promise<JSX.Element> {
  const initialFilmographyResponse = await fetchPersonFilmography(personId, 1);
  if (!initialFilmographyResponse?.results)
    return <div>No filmography found</div>;

  const validInitialResults = initialFilmographyResponse.results.filter(
    (
      item,
    ): item is {
      id: number;
      genre_ids?: number[];
      poster_path?: string | null;
    } =>
      isValidMediaData(item) &&
      Boolean((item as { poster_path?: string | null }).poster_path),
  );

  if (validInitialResults.length === 0) return <div>No filmography found</div>;

  const initialFilmography = await buildItemsWithCategories(
    validInitialResults,
    "multi",
  );

  const initialOffset = 2;
  const getFilmographyListNodes = async (offset: number) => {
    "use server";
    try {
      const response = await fetchPersonFilmography(personId, offset);

      if (!response?.results) {
        return null;
      }

      // Filter out items without poster_path and validate required fields
      const validResults = response.results.filter(
        (
          item,
        ): item is {
          id: number;
          genre_ids?: number[];
          poster_path?: string | null;
        } =>
          isValidMediaData(item) &&
          Boolean((item as { poster_path?: string | null }).poster_path),
      );

      if (validResults.length === 0) {
        return null;
      }

      // Transform the raw results into MediaItem[]
      const processedFilmography = await buildItemsWithCategories(
        validResults,
        "multi",
      );

      const nextOffset =
        offset < (response.total_pages || 0) ? offset + 1 : null;

      return [
        <ContentGrid items={processedFilmography} key={offset} type="multi" />,
        nextOffset,
      ] as const;
    } catch (error) {
      console.error("Error loading more filmography:", error);
      return null;
    }
  };

  return (
    <LoadMore
      key={personId}
      getMovieListNodes={getFilmographyListNodes}
      initialOffset={initialOffset}
    >
      <ContentGrid items={initialFilmography} type="multi" />
    </LoadMore>
  );
}
