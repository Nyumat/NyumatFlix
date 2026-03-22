import { MediaVideos } from "@/components/media/media-shared";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import { tmdb } from "@/tmdb/api";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const m = await getCachedTvShowDetail(id).catch(() => null);
  if (!m || !("name" in m)) return { title: "Videos" };
  return { title: `Videos · ${m.name}` };
}

export default async function TVShowVideosPage(props: Props) {
  const { id } = await props.params;
  const m = await getCachedTvShowDetail(id).catch(() => null);
  if (!m) notFound();

  const { results: videos } = await tmdb.tv.videos({ id });

  return <MediaVideos videos={videos} />;
}
