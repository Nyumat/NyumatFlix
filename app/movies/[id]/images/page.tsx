import { MediaImages } from "@/components/media/media-client";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import { tmdb } from "@/tmdb/api";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const m = await getCachedMovieDetail(id);
  if (!m || !("title" in m)) return { title: "Images" };
  return { title: `Images · ${m.title}` };
}

export default async function MovieImagesPage(props: Props) {
  const { id } = await props.params;
  const m = await getCachedMovieDetail(id);
  if (!m || !("title" in m)) notFound();

  const { posters, backdrops } = await tmdb.movie.images({
    id,
    langs: "en,null",
  });

  return <MediaImages posters={posters} backdrops={backdrops} />;
}
