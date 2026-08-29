import { AniListFiltersDynamic } from "@/components/anilist/anilist-filters-dynamic";
import { AnimeResultsGrid } from "@/components/anilist/anime-results-grid";
import { CatalogPageShell } from "@/components/catalog/catalog-page-shell";
import { CatalogGridFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { Button } from "@/components/ui/button";
import { parseAniListSearchParams } from "@/lib/anilist";
import { normalizeRouteSearchParams } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const revalidate = 3600;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Browse Anime | NyumatFlix",
  description: "Browse all anime sorted by trending on AniList.",
};

const toPageNumber = (value: string | undefined) => {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

export default async function AnimeBrowsePage(props: PageProps) {
  const raw = await props.searchParams;
  const sp = normalizeRouteSearchParams(raw);

  if (sp.mode === "results") {
    const { mode: _mode, ...rest } = sp;
    const next = new URLSearchParams(rest);
    const query = next.toString();
    redirect(query ? `/anime/browse?${query}` : "/anime/browse");
  }

  const params = parseAniListSearchParams(sp);
  const currentPage = toPageNumber(sp.page);

  return (
    <CatalogPageShell
      title="Anime"
      toolbar={<AniListFiltersDynamic serverParams={sp} />}
      action={
        <Button asChild variant="outline">
          <Link href="/anime">Anime home</Link>
        </Button>
      }
    >
      <Suspense fallback={<CatalogGridFallback />}>
        <AnimeResultsGrid params={params} page={currentPage} />
      </Suspense>
    </CatalogPageShell>
  );
}
