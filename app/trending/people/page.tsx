import { TrendList } from "@/components/trend/trend-server";
import { pages } from "@/config/pages";
import { buildCatalogMetadata } from "@/lib/seo/metadata";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return buildCatalogMetadata({
    title: pages.trending.people.title,
    description:
      "Browse trending actors, directors, and creators on NyumatFlix.",
    path: pages.trending.people.link,
  });
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
