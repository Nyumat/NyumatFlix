import { MovieCard } from "@/components/movie/movie-card";
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
  if (!m || !("title" in m)) return { title: "Similar" };
  return { title: `Similar · ${m.title}` };
}

export default async function MovieSimilarPage(props: Props) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const page = searchParams.page ?? "1";

  const m = await getCachedMovieDetail(id);
  if (!m || !("title" in m)) notFound();

  const {
    results: movies,
    total_pages: totalPages,
    page: currentPage,
  } = await tmdb.movie.similar({ id, page });

  if (!movies?.length) {
    return <div className="empty-box">No similar titles</div>;
  }

  return (
    <div className="space-y-4">
      <section className="grid-list">
        {movies.map((movie) => (
          <MovieCard key={movie.id} {...movie} />
        ))}
      </section>
      <ListPagination currentPage={currentPage} totalPages={totalPages} />
    </div>
  );
}
