"use client";

import { CatalogRowFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import {
  MoviesSeriesTabs,
  type CatalogMediaKind,
  type CatalogShowcaseRow,
} from "@/components/catalog/catalog-genre-rail";
import {
  RecommendationSeed,
  TrendCarousel,
} from "@/components/trend/trend-client";
import { matchShowcaseRowId } from "@/lib/catalog-showcase-select";
import { isAbortError } from "@/lib/scrape/abort";
import type { MovieWithMediaType, TvShowWithMediaType } from "@/tmdb/models";
import { useEffect, useMemo, useState } from "react";

type CatalogShowcaseCatalog = "movies" | "tv" | "anime";
type CatalogShowcaseApiKey = "movies" | "tv" | "anime-series" | "anime-movie";

type CatalogShowcaseResponse = {
  rows?: CatalogShowcaseRow[];
};

const kindForCatalog = (catalog: CatalogShowcaseCatalog): CatalogMediaKind =>
  catalog === "movies" ? "movie" : "tv";

const apiKeyForKind = (
  catalog: CatalogShowcaseCatalog,
  kind: CatalogMediaKind,
): CatalogShowcaseApiKey => {
  if (catalog === "anime") {
    return kind === "movie" ? "anime-movie" : "anime-series";
  }
  return kind === "movie" ? "movies" : "tv";
};

const fetchShowcaseRows = async (
  pageKey: CatalogShowcaseApiKey,
  excludeIdsKey: string,
  signal: AbortSignal,
): Promise<CatalogShowcaseRow[]> => {
  const params = new URLSearchParams({ pageKey });
  if (excludeIdsKey) {
    params.set("excludeIds", excludeIdsKey);
  }

  const response = await fetch(`/api/catalog/showcase?${params}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as CatalogShowcaseResponse;
  return Array.isArray(payload.rows) ? payload.rows : [];
};

export const CatalogCategoryShowcase = ({
  pageKey,
  excludeIds = [],
  initialRowsByKind,
}: {
  pageKey: CatalogShowcaseCatalog;
  excludeIds?: number[];
  initialRowsByKind?: {
    movie: CatalogShowcaseRow[] | null;
    tv: CatalogShowcaseRow[] | null;
  };
}) => {
  const excludeIdsKey = useMemo(
    () => excludeIds.filter((id) => Number.isInteger(id) && id > 0).join(","),
    [excludeIds],
  );
  const [mediaKind, setMediaKind] = useState<CatalogMediaKind>(() =>
    kindForCatalog(pageKey),
  );
  const [rowsByKind, setRowsByKind] = useState<{
    movie: CatalogShowcaseRow[] | null;
    tv: CatalogShowcaseRow[] | null;
  }>(() => initialRowsByKind ?? { movie: null, tv: null });
  const [selectedRowId, setSelectedRowId] = useState("");

  useEffect(() => {
    if (initialRowsByKind) {
      const initialKind = kindForCatalog(pageKey);
      const rows = initialRowsByKind[initialKind];
      if (rows?.length) {
        setSelectedRowId((currentId) => {
          if (currentId && rows.some((row) => row.rowId === currentId)) {
            return currentId;
          }
          return rows[0]?.rowId ?? "";
        });
      }
      return;
    }

    const controller = new AbortController();
    const initialKind = kindForCatalog(pageKey);
    const otherKind: CatalogMediaKind =
      initialKind === "movie" ? "tv" : "movie";

    const loadKind = async (kind: CatalogMediaKind) => {
      try {
        const rows = await fetchShowcaseRows(
          apiKeyForKind(pageKey, kind),
          excludeIdsKey,
          controller.signal,
        );
        if (controller.signal.aborted) {
          return;
        }

        setRowsByKind((current) => ({ ...current, [kind]: rows }));
        if (kind === initialKind) {
          setSelectedRowId((currentId) => {
            if (currentId && rows.some((row) => row.rowId === currentId)) {
              return currentId;
            }
            return rows[0]?.rowId ?? "";
          });
        }
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return;
        }
        throw error;
      }
    };

    void (async () => {
      await loadKind(initialKind);
      if (!controller.signal.aborted) {
        await loadKind(otherKind);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [excludeIdsKey, initialRowsByKind, pageKey]);

  const rows = rowsByKind[mediaKind];
  const selectedRow =
    rows?.find((row) => row.rowId === selectedRowId) ?? rows?.[0];

  const handleMediaKindChange = (nextKind: CatalogMediaKind) => {
    if (nextKind === mediaKind) {
      return;
    }

    const previousTitle = selectedRow?.title;
    const nextRows = rowsByKind[nextKind];
    if (nextRows) {
      setSelectedRowId(matchShowcaseRowId(nextRows, previousTitle) ?? "");
    }
    setMediaKind(nextKind);
  };

  useEffect(() => {
    if (!rows || rows.length === 0) {
      return;
    }

    const stillAvailable = rows.some((row) => row.rowId === selectedRowId);
    if (!stillAvailable) {
      const previousTitle =
        rowsByKind.movie?.find((row) => row.rowId === selectedRowId)?.title ??
        rowsByKind.tv?.find((row) => row.rowId === selectedRowId)?.title;
      setSelectedRowId(matchShowcaseRowId(rows, previousTitle) ?? "");
    }
  }, [rows, rowsByKind.movie, rowsByKind.tv, selectedRowId]);

  if (rows === null) {
    return <CatalogRowFallback bleed />;
  }

  if (!selectedRow || selectedRow.items.length === 0) {
    return null;
  }

  const carouselType = pageKey === "anime" ? "tv" : mediaKind;
  const items =
    carouselType === "movie"
      ? (selectedRow.items as MovieWithMediaType[])
      : (selectedRow.items as TvShowWithMediaType[]);

  return (
    <TrendCarousel
      key={`${mediaKind}-${selectedRow.rowId}`}
      type={carouselType}
      title={selectedRow.title}
      items={items}
      compact
      bleed
      heading={
        <RecommendationSeed
          title={selectedRow.title}
          large
          options={rows.map((row) => ({
            value: row.rowId,
            title: row.title,
          }))}
          selectedValue={selectedRow.rowId}
          onValueChange={setSelectedRowId}
        />
      }
      trailing={
        <MoviesSeriesTabs value={mediaKind} onChange={handleMediaKindChange} />
      }
    />
  );
};
