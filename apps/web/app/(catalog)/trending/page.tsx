import { TrendingIndexHubLoading } from "@/components/layout/page-loading/catalog-hub-loading";
import { TrendingHubPage } from "@/components/trending/trending-hub-page";
import { buildCatalogMetadata } from "@/lib/seo/metadata";
import { pages } from "@/config/pages";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = buildCatalogMetadata({
  title: pages.trending.root.title,
  description:
    "Explore trending movies, TV shows, and people updated throughout the day on NyumatFlix.",
  path: pages.trending.root.link,
});

export const instant = true;

export default function TrendingHub() {
  return (
    <Suspense fallback={<TrendingIndexHubLoading withPageContainer={false} />}>
      <TrendingHubPage />
    </Suspense>
  );
}
