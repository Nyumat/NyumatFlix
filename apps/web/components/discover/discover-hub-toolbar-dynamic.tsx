"use client";

import { DiscoverToolbarSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import { useClientMounted } from "@/hooks/use-client-mounted";
import dynamic from "next/dynamic";
import type { Genre, WatchProvider } from "@/tmdb/models";

const DiscoverHubToolbarInner = dynamic(
  () =>
    import("./discover-hub-toolbar-inner").then(
      (mod) => mod.DiscoverHubToolbarInner,
    ),
  {
    ssr: false,
    loading: () => <DiscoverToolbarSkeleton />,
  },
);

type DiscoverHubToolbarDynamicProps = {
  type: "movie" | "tv";
  genres: Genre[];
  providers: WatchProvider[];
  serverDiscoverFilters: Record<string, string>;
};

export const DiscoverHubToolbarDynamic = (
  props: DiscoverHubToolbarDynamicProps,
) => {
  const mounted = useClientMounted();

  if (!mounted) {
    return <DiscoverToolbarSkeleton />;
  }

  return <DiscoverHubToolbarInner {...props} />;
};
