import { ListPagination } from "@/components/shared/list-pagination";
import { TvCard } from "@/components/tv/tv-card";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import { tmdb } from "@/tmdb/api";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const m = await getCachedTvShowDetail(id).catch(() => null);
  if (!m || !("name" in m)) return { title: "Recommendations" };
  return { title: `Recommendations · ${m.name}` };
}

export default async function TVShowRecommendationsPage(props: Props) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const page = searchParams.page ?? "1";

  const m = await getCachedTvShowDetail(id).catch(() => null);
  if (!m) notFound();

  const {
    results: shows,
    total_pages: totalPages,
    page: currentPage,
  } = await tmdb.tv.recommendations({ id, page });

  if (!shows?.length) {
    return <div className="empty-box">No recommendations</div>;
  }

  return (
    <div className="space-y-4">
      <section className="grid-list">
        {shows.map((show) => (
          <TvCard key={show.id} {...show} />
        ))}
      </section>
      <ListPagination currentPage={currentPage} totalPages={totalPages} />
    </div>
  );
}
