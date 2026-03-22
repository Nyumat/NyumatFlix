import { TrendList } from "@/components/trend";
import { pages } from "@/config/pages";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${pages.trending.movie.title} | NyumatFlix`,
    description: pages.trending.movie.description,
  };
}

export default async function TrendingMovie({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  return (
    <TrendList
      type="movie"
      time="day"
      title={pages.trending.movie.title}
      description={pages.trending.movie.description}
      page={sp.page ?? "1"}
    />
  );
}
