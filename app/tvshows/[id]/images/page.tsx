import { MediaImages } from "@/components/media/media-client";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import { tmdb } from "@/tmdb/api";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const m = await getCachedTvShowDetail(id).catch(() => null);
  if (!m || !("name" in m)) return { title: "Images" };
  return { title: `Images · ${m.name}` };
}

export default async function TVShowImagesPage(props: Props) {
  const { id } = await props.params;
  const m = await getCachedTvShowDetail(id).catch(() => null);
  if (!m) notFound();

  const { posters, backdrops } = await tmdb.tv.images({
    id,
    langs: "en,null",
  });

  return <MediaImages posters={posters} backdrops={backdrops} />;
}
