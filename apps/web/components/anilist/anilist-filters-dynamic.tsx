"use client";

import { AniListToolbarSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import { useClientMounted } from "@/hooks/use-client-mounted";
import dynamic from "next/dynamic";

const AniListFiltersInner = dynamic(
  () => import("./anilist-filters").then((mod) => mod.AniListFilters),
  {
    ssr: false,
    loading: () => <AniListToolbarSkeleton />,
  },
);

type AniListFiltersDynamicProps = {
  serverParams: Record<string, string>;
};

export const AniListFiltersDynamic = ({
  serverParams,
}: AniListFiltersDynamicProps) => {
  const mounted = useClientMounted();

  if (!mounted) {
    return <AniListToolbarSkeleton />;
  }

  return <AniListFiltersInner serverParams={serverParams} />;
};
