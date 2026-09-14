"use client";

import { CatalogPosterRowFallback } from "@/components/catalog/catalog-poster-row-fallback";
import {
  MoviesSeriesTabs,
  type CatalogMediaKind,
} from "@/components/catalog/catalog-genre-rail";
import {
  ProviderWatchSelect,
  type ProviderWatchBrand,
} from "@/components/provider/provider-watch-select";
import { TrendCarousel } from "@/components/trend/trend-client";
import {
  fetchProviderPopularItems,
  providerPopularCacheKey,
  readProviderPopularCache,
  writeProviderPopularCache,
  type ProviderPopularCacheKey,
} from "@/lib/client/provider-popular-cache";
import { isAbortError } from "@/lib/scrape/abort";
import type { MediaItem } from "@/lib/domain/typings";
import type { MovieWithMediaType, TvShowWithMediaType } from "@/tmdb/models";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const loadKindsForProvider = async (
  providerId: string,
  kinds: CatalogMediaKind[],
  signal: AbortSignal,
  onLoaded: (key: ProviderPopularCacheKey, items: MediaItem[]) => void,
) => {
  await Promise.all(
    kinds.map(async (kind) => {
      const key = providerPopularCacheKey(providerId, kind);
      if (readProviderPopularCache(key)) {
        onLoaded(key, readProviderPopularCache(key)!);
        return;
      }

      try {
        const items = await fetchProviderPopularItems(providerId, kind, signal);
        if (signal.aborted) {
          return;
        }
        writeProviderPopularCache(key, items);
        onLoaded(key, items);
      } catch (error) {
        if (signal.aborted || isAbortError(error)) {
          return;
        }
        throw error;
      }
    }),
  );
};

export function HomeProviderGenreShowcase({
  providers,
  defaultProviderId,
  initialItemsByKey = {},
}: {
  providers: ProviderWatchBrand[];
  defaultProviderId: number;
  initialItemsByKey?: Partial<Record<ProviderPopularCacheKey, MediaItem[]>>;
}) {
  const [providerId, setProviderId] = useState(String(defaultProviderId));
  const [mediaKind, setMediaKind] = useState<CatalogMediaKind>("movie");
  const [itemsByKey, setItemsByKey] = useState<
    Partial<Record<ProviderPopularCacheKey, MediaItem[]>>
  >(() => {
    for (const [key, items] of Object.entries(initialItemsByKey)) {
      if (items?.length) {
        writeProviderPopularCache(key as ProviderPopularCacheKey, items);
      }
    }
    return { ...initialItemsByKey };
  });
  const loadGenerationRef = useRef(0);

  const mergeItems = useCallback(
    (key: ProviderPopularCacheKey, items: MediaItem[]) => {
      setItemsByKey((current) => ({ ...current, [key]: items }));
    },
    [],
  );

  const prefetchProvider = useCallback(
    (targetProviderId: string, kind: CatalogMediaKind = mediaKind) => {
      const key = providerPopularCacheKey(targetProviderId, kind);
      const cached = readProviderPopularCache(key);
      if (cached) {
        mergeItems(key, cached);
        return;
      }

      void fetchProviderPopularItems(targetProviderId, kind).then((items) => {
        mergeItems(key, items);
      });
    },
    [mediaKind, mergeItems],
  );

  const prefetchProviderBothKinds = useCallback(
    (targetProviderId: string) => {
      prefetchProvider(targetProviderId, "movie");
      prefetchProvider(targetProviderId, "tv");
    },
    [prefetchProvider],
  );

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    const controller = new AbortController();

    void loadKindsForProvider(
      providerId,
      ["movie", "tv"],
      controller.signal,
      (key, items) => {
        if (generation !== loadGenerationRef.current) {
          return;
        }
        mergeItems(key, items);
      },
    );

    return () => {
      controller.abort();
    };
  }, [mergeItems, providerId]);

  useEffect(() => {
    const key = providerPopularCacheKey(providerId, mediaKind);
    if (itemsByKey[key] !== undefined || readProviderPopularCache(key)) {
      if (readProviderPopularCache(key) && !itemsByKey[key]) {
        mergeItems(key, readProviderPopularCache(key)!);
      }
      return;
    }

    const controller = new AbortController();
    void fetchProviderPopularItems(providerId, mediaKind, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          mergeItems(key, items);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          throw error;
        }
      });

    return () => {
      controller.abort();
    };
  }, [itemsByKey, mediaKind, mergeItems, providerId]);

  useEffect(() => {
    const schedule = () => {
      for (const provider of providers.slice(0, 6)) {
        const id = String(provider.id);
        if (id === providerId) {
          continue;
        }
        prefetchProvider(id, "movie");
        prefetchProvider(id, "tv");
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(schedule, { timeout: 3000 });
      return () => {
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(schedule, 600);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [prefetchProvider, providerId, providers]);

  const activeKey = providerPopularCacheKey(providerId, mediaKind);
  const items = itemsByKey[activeKey];
  const isCarouselLoading = items === undefined;

  const handleProviderChange = (nextProviderId: string) => {
    if (nextProviderId === providerId) {
      return;
    }
    setProviderId(nextProviderId);
  };

  const activeProviderName =
    providers.find((provider) => String(provider.id) === providerId)?.name ??
    "provider";

  if (!isCarouselLoading && items && items.length === 0) {
    return null;
  }

  const carouselItems =
    items && mediaKind === "movie"
      ? (items as MovieWithMediaType[])
      : (items as TvShowWithMediaType[]);

  return (
    <section
      className="index-bleed"
      aria-label={`Popular on ${activeProviderName}`}
      aria-busy={isCarouselLoading}
    >
      <div
        className={cn(
          "mb-4 flex min-w-0 gap-3 md:gap-4",
          "items-end justify-between gap-x-4",
          "index-rail-padding",
        )}
      >
        <div className="flex min-w-0 w-fit max-w-full shrink-0 items-end gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="shrink-0 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              Only on
            </h2>
            <ProviderWatchSelect
              providers={providers}
              value={providerId}
              onValueChange={handleProviderChange}
              onProviderPrefetch={prefetchProviderBothKinds}
              onMenuOpen={() => {
                for (const provider of providers) {
                  prefetchProviderBothKinds(String(provider.id));
                }
              }}
              large
            />
          </div>
        </div>

        <MoviesSeriesTabs value={mediaKind} onChange={setMediaKind} />
      </div>

      {isCarouselLoading ? (
        <CatalogPosterRowFallback hideHeader railPadding />
      ) : (
        <TrendCarousel
          key={`${providerId}-${mediaKind}`}
          type={mediaKind}
          items={carouselItems}
          compact
          bleed={false}
          railPadding
          showToolbar={false}
        />
      )}
    </section>
  );
}
