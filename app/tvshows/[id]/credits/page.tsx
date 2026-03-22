import { MediaCreditsList } from "@/components/media/media-shared";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import { tmdb } from "@/tmdb/api";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const m = await getCachedTvShowDetail(id).catch(() => null);
  if (!m || !("name" in m)) return { title: "Cast" };
  return { title: `Cast · ${m.name}` };
}

export default async function TVShowCreditsPage(props: Props) {
  const { id } = await props.params;
  const m = await getCachedTvShowDetail(id).catch(() => null);
  if (!m) notFound();

  const { cast, crew } = await tmdb.tv.credits({ id });

  return <MediaCreditsList cast={cast} crew={crew} />;
}
