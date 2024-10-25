import { getMovies, getTVShows } from "@/app/actions";
import { ContentGrid } from "@/components/content-grid";
import { getMovieListNodes, getTvShowListNodes } from "@/components/nodes";
import {
  MovieCategory,
  TVShowCategory,
  TVShowCategoryEnum,
  UnifiedCategory,
} from "@/utils/typings";
import { LoadMore } from "./load-more";

interface ICProps {
  type: UnifiedCategory;
}

export async function InfiniteContent({ type }: ICProps): Promise<JSX.Element> {
  const isTVShow = TVShowCategoryEnum.safeParse(type).success;
  const initialContent = isTVShow
    ? await getTVShows(type as TVShowCategory, 1)
    : await getMovies(type as MovieCategory, 1);

  if (!initialContent?.results) return <div>No content found</div>;

  const initialOffset = 2;

  return (
    <LoadMore
      key={type}
      getListNodes={isTVShow ? getTvShowListNodes : getMovieListNodes}
      initialOffset={initialOffset}
      type={type}
    >
      <ContentGrid
        items={initialContent.results}
        type={isTVShow ? "tv" : "movie"}
      />
    </LoadMore>
  );
}
