import { MediaReviewCard } from "@/components/media/media-review-card";
import { ListPagination } from "@/components/shared/list-pagination";
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
  if (!m || !("name" in m)) return { title: "Reviews" };
  return { title: `Reviews · ${m.name}` };
}

export default async function TVShowReviewsPage(props: Props) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const page = searchParams.page ?? "1";

  const m = await getCachedTvShowDetail(id).catch(() => null);
  if (!m) notFound();

  const {
    results,
    page: currentPage,
    total_pages,
  } = await tmdb.tv.reviews({
    id,
    page,
  });

  if (!results.length) {
    return <div className="empty-box">No reviews</div>;
  }

  return (
    <section className="space-y-8">
      {results.map((review) => (
        <MediaReviewCard key={review.id} review={review} />
      ))}
      <ListPagination currentPage={currentPage} totalPages={total_pages} />
    </section>
  );
}
