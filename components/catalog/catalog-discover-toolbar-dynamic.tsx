"use client";

import { DiscoverToolbarSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import { useClientMounted } from "@/hooks/use-client-mounted";
import dynamic from "next/dynamic";
import type { Genre, WatchProvider } from "@/tmdb/models";

const CatalogDiscoverToolbarInner = dynamic(
  () =>
    import("./catalog-discover-toolbar").then(
      (mod) => mod.CatalogDiscoverToolbar,
    ),
  {
    ssr: false,
    loading: () => <DiscoverToolbarSkeleton />,
  },
);

type CatalogDiscoverToolbarDynamicProps = {
  mediaType: "movie" | "tv";
  genres: Genre[];
  providers: WatchProvider[];
  serverDiscoverFilters: Record<string, string>;
  resultCount: number;
};

export const CatalogDiscoverToolbarDynamic = ({
  mediaType,
  genres,
  providers,
  serverDiscoverFilters,
  resultCount,
}: CatalogDiscoverToolbarDynamicProps) => {
  const mounted = useClientMounted();

  if (!mounted) {
    return <DiscoverToolbarSkeleton />;
  }

  return (
    <CatalogDiscoverToolbarInner
      mediaType={mediaType}
      genres={genres}
      providers={providers}
      serverDiscoverFilters={serverDiscoverFilters}
      resultCount={resultCount}
    />
  );
};
