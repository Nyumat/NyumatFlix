"use client";

import { TrendCarousel } from "@/components/trend/trend-client";
import type { MovieWithMediaType, TvShowWithMediaType } from "@/tmdb/models";
import type { MediaItem } from "@/lib/domain/typings";
import { useEffect, useMemo, useState } from "react";

const SHOWCASE_START_DELAY_MS = 2500;
const SHOWCASE_IDLE_TIMEOUT_MS = 2000;

type CatalogShowcaseRow = {
  rowId: string;
  title: string;
  href: string;
  items: MediaItem[];
};

type CatalogShowcaseResponse = {
  rows?: CatalogShowcaseRow[];
};

export const CatalogCategoryShowcase = ({
  pageKey,
  excludeIds = [],
}: {
  pageKey: "movies" | "tv";
  excludeIds?: number[];
}) => {
  const mediaType = pageKey === "movies" ? "movie" : "tv";
  const excludeIdsKey = useMemo(
    () => excludeIds.filter((id) => Number.isInteger(id) && id > 0).join(","),
    [excludeIds],
  );
  const [rowsData, setRowsData] = useState<CatalogShowcaseRow[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let startDelayId: number | null = null;
    let idleId: number | null = null;

    const loadRows = async () => {
      const params = new URLSearchParams({ pageKey });
      if (excludeIdsKey) {
        params.set("excludeIds", excludeIdsKey);
      }

      try {
        const response = await fetch(`/api/catalog/showcase?${params}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = (await response.json()) as CatalogShowcaseResponse;
        setRowsData(Array.isArray(payload.rows) ? payload.rows : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Catalog showcase load error:", error);
        }
      }
    };

    startDelayId = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(
          () => {
            void loadRows();
          },
          { timeout: SHOWCASE_IDLE_TIMEOUT_MS },
        );
        return;
      }

      void loadRows();
    }, SHOWCASE_START_DELAY_MS);

    return () => {
      controller.abort();
      if (startDelayId !== null) window.clearTimeout(startDelayId);
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [excludeIdsKey, pageKey]);

  if (rowsData.length === 0) {
    return null;
  }

  return (
    <>
      {rowsData.map((row) => {
        if (row.items.length === 0) return null;
        const items =
          mediaType === "movie"
            ? (row.items as MovieWithMediaType[])
            : (row.items as TvShowWithMediaType[]);
        return (
          <TrendCarousel
            key={row.rowId}
            type={mediaType}
            title={row.title}
            description={undefined}
            link={row.href}
            items={items}
            compact
            bleed
          />
        );
      })}
    </>
  );
};
