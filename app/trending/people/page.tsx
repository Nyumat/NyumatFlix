import { TrendList } from "@/components/trend";
import { pages } from "@/config/pages";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${pages.trending.people.title} | NyumatFlix`,
  };
}

export default async function TrendingPeople({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  return (
    <TrendList
      type="people"
      time="day"
      title={pages.trending.people.title}
      page={sp.page ?? "1"}
    />
  );
}
