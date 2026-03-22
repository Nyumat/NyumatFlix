import { MediaReviewCard } from "@/components/media/media-review-card";
import { ListPagination } from "@/components/shared/list-pagination";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import { tmdb } from "@/tmdb/api";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const m = await getCachedMovieDetail(id);
  if (!m || !("title" in m)) return { title: "Reviews" };
  return { title: `Reviews · ${m.title}` };
}

export default async function MovieReviewsPage(props: Props) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const page = searchParams.page ?? "1";

  const m = await getCachedMovieDetail(id);
  if (!m || !("title" in m)) notFound();

  const {
    results,
    page: currentPage,
    total_pages,
  } = await tmdb.movie.reviews({
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
