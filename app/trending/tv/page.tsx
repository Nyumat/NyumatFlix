import { buildCatalogCtaUrl } from "@/lib/catalog-query";
import { pages } from "@/config/pages";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${pages.trending.tv.title} | NyumatFlix`,
  };
}

export default async function TrendingTv({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; trending_time?: string }>;
}) {
  const sp = await searchParams;
  const path = buildCatalogCtaUrl("tv", {
    view: "trending",
    mode: "results",
    trendingTime: sp.trending_time === "week" ? "week" : "day",
    extra: sp.page ? { page: sp.page } : undefined,
  });
  redirect(path);
}
