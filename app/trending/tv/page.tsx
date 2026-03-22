import { TrendList } from "@/components/trend";
import { pages } from "@/config/pages";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${pages.trending.tv.title} | NyumatFlix`,
    description: pages.trending.tv.description,
  };
}

export default async function TrendingTv({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  return (
    <TrendList
      type="tv"
      time="day"
      title={pages.trending.tv.title}
      description={pages.trending.tv.description}
      page={sp.page ?? "1"}
    />
  );
}
