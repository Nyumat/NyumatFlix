import { MediaVideos } from "@/components/media/media-shared";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import { tmdb } from "@/tmdb/api";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const m = await getCachedMovieDetail(id);
  if (!m || !("title" in m)) return { title: "Videos" };
  return { title: `Videos · ${m.title}` };
}

export default async function MovieVideosPage(props: Props) {
  const { id } = await props.params;
  const m = await getCachedMovieDetail(id);
  if (!m || !("title" in m)) notFound();

  const { results: videos } = await tmdb.movie.videos({ id });

  return <MediaVideos videos={videos} />;
}
