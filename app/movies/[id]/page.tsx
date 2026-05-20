import { MovieDetailTabPanels } from "@/components/movie/movie-detail-tab-panels";
import { fetchTMDBData } from "@/app/actions";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import { generateMediaMetadata } from "@/utils/media-metadata-helpers";
import { MediaItem } from "@/utils/typings";
import { Metadata } from "next";

export const dynamicParams = true;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const [popular, topRated, nowPlaying] = await Promise.all([
    fetchTMDBData("/movie/popular", { language: "en-US", region: "US" }),
    fetchTMDBData("/movie/top_rated", { language: "en-US", region: "US" }),
    fetchTMDBData("/movie/now_playing", { language: "en-US", region: "US" }),
  ]);

  const allMovies = [
    ...((popular.results as MediaItem[]) || []),
    ...((topRated.results as MediaItem[]) || []),
    ...((nowPlaying.results as MediaItem[]) || []),
  ];

  const uniqueMovies = Array.from(
    new Map(allMovies.map((movie) => [movie.id, movie])).values(),
  );

  return uniqueMovies.slice(0, 60).map((movie) => ({
    id: movie.id.toString(),
  }));
}

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
