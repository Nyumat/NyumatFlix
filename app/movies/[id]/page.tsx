import { MovieDetailTabPanels } from "@/components/movie/movie-detail-tab-panels";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import { generateMediaMetadata } from "@/utils/media-metadata-helpers";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MovieDetailPage(props: Props) {
  const { id } = await props.params;

  return <MovieDetailTabPanels movieId={id} />;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const movie = await getCachedMovieDetail(id);
  return generateMediaMetadata({
    media: movie,
    mediaType: "movie",
    mediaId: id,
  });
}
