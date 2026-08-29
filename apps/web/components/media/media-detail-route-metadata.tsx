"use client";

import { useDetailRouteStore } from "@/lib/stores/detail-route-store";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const resolveDetailParentRoute = (
  mediaType: "movie" | "tv",
  anilistId?: number | null | undefined,
): string => {
  if (Number.isInteger(anilistId)) {
    return "/anime";
  }

  return mediaType === "movie" ? "/movies" : "/tvshows";
};

type MediaDetailRouteMetadataProps = {
  mediaType: "movie" | "tv";
  anilistId?: number | null | undefined;
};

export const MediaDetailRouteMetadata = ({
  mediaType,
  anilistId,
}: MediaDetailRouteMetadataProps) => {
  const pathname = usePathname();
  const setDetailRouteMetadata = useDetailRouteStore(
    (state) => state.setDetailRouteMetadata,
  );
  const clearDetailRouteMetadata = useDetailRouteStore(
    (state) => state.clearDetailRouteMetadata,
  );
  const parentRoute = resolveDetailParentRoute(mediaType, anilistId);

  useEffect(() => {
    setDetailRouteMetadata({ pathname, parentRoute });

    return () => clearDetailRouteMetadata(pathname);
  }, [clearDetailRouteMetadata, parentRoute, pathname, setDetailRouteMetadata]);

  return null;
};
