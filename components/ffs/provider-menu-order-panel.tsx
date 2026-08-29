"use client";

import { FeatureFlagsProvider } from "@/components/providers/feature-flags-provider";
import { ServerSelector } from "@/components/media/controls/server-selector";
import { SortableProviderList } from "@/components/ffs/sortable-provider-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdminFlagState } from "@/lib/flags/flag-catalog";
import {
  animeScrapeProviderFlagKey,
  embedProviderFlagKey,
  tmdbScrapeProviderFlagKey,
} from "@/lib/flags/flag-catalog";
import {
  DEFAULT_PROVIDER_MENU_ORDER,
  type ProviderMenuOrderConfig,
} from "@/lib/flags/provider-menu-order";
import {
  isAnimeScrapeProviderEnabled,
  isTmdbScrapeProviderEnabled,
  resolveSiteFlags,
  type SiteFlags,
} from "@/lib/flags/site-flags";
import { buildGroupedAnimePlaybackProviderOptions } from "@/lib/providers/anime-playback-chain";
import {
  ANIME_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_ORDER,
  dualCapabilityEmbedProviderIds,
  embedOnlyProviderIds,
  TMDB_SCRAPE_PROVIDER_LABELS,
  TMDB_SCRAPE_PROVIDER_ORDER,
} from "@/lib/providers/registry";
import { videoServers } from "@/lib/stores/video-servers";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

type ProviderMenuOrderPanelProps = {
  flags: AdminFlagState;
  menuOrder: ProviderMenuOrderConfig;
  onMenuOrderChange: (next: ProviderMenuOrderConfig) => void;
};

type PreviewMode = "proxy-movie" | "proxy-anime" | "iframe";

const EMBED_ONLY_IDS = new Set(embedOnlyProviderIds());
const DUAL_EMBED_IDS = new Set(dualCapabilityEmbedProviderIds());

const splitEmbedOrder = (order: readonly string[]) => ({
  embedOnly: order.filter((id) => EMBED_ONLY_IDS.has(id)),
  dual: order.filter((id) => DUAL_EMBED_IDS.has(id)),
});

const mergeEmbedOrder = (embedOnly: string[], dual: string[]) => [
  ...embedOnly,
  ...dual,
];

const ANIME_PREVIEW_CONTEXT = {
  mappingConfidence: "high" as const,
  isAdultAnime: false,
  anilistGenres: ["Action"],
};

const buildPreviewSiteFlags = (
  flags: AdminFlagState,
  menuOrder: ProviderMenuOrderConfig,
): SiteFlags => {
  const resolved = resolveSiteFlags(flags, undefined, menuOrder);
  return {
    ...resolved,
    proxyModeOnly: false,
    iframeModeOnly: false,
    directScrapeProviderAvailable: true,
    locks: {
      ...resolved.locks,
      playbackMode: false,
    },
  };
};

export function ProviderMenuOrderPanel({
  flags,
  menuOrder,
  onMenuOrderChange,
}: ProviderMenuOrderPanelProps) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("proxy-movie");

  const previewFlags = useMemo(
    () => buildPreviewSiteFlags(flags, menuOrder),
    [flags, menuOrder],
  );

  const embedSections = useMemo(
    () => splitEmbedOrder(menuOrder.embed),
    [menuOrder.embed],
  );

  const tmdbItems = useMemo(
    () =>
      menuOrder.tmdbScrape.map((id) => ({
        id,
        label:
          TMDB_SCRAPE_PROVIDER_LABELS[
            id as keyof typeof TMDB_SCRAPE_PROVIDER_LABELS
          ] ?? id,
        enabled:
          flags[
            tmdbScrapeProviderFlagKey(
              id as keyof typeof TMDB_SCRAPE_PROVIDER_LABELS,
            )
          ] ?? true,
        hint: id,
      })),
    [flags, menuOrder.tmdbScrape],
  );

  const animeItems = useMemo(
    () =>
      menuOrder.animeScrape.map((id) => ({
        id,
        label:
          ANIME_SCRAPE_PROVIDER_LABELS[
            id as keyof typeof ANIME_SCRAPE_PROVIDER_LABELS
          ] ?? id,
        enabled:
          flags[
            animeScrapeProviderFlagKey(
              id as keyof typeof ANIME_SCRAPE_PROVIDER_LABELS,
            )
          ] ?? true,
        hint: id,
      })),
    [flags, menuOrder.animeScrape],
  );

  const embedOnlyItems = useMemo(
    () =>
      embedSections.embedOnly.map((id) => {
        const server = videoServers.find((entry) => entry.id === id);
        return {
          id,
          label: server?.name ?? id,
          enabled:
            flags[
              embedProviderFlagKey(
                id as Parameters<typeof embedProviderFlagKey>[0],
              )
            ] ?? true,
          hint: id,
        };
      }),
    [embedSections.embedOnly, flags],
  );

  const dualEmbedItems = useMemo(
    () =>
      embedSections.dual.map((id) => {
        const server = videoServers.find((entry) => entry.id === id);
        return {
          id,
          label: server?.name ?? id,
          enabled:
            flags[
              embedProviderFlagKey(
                id as Parameters<typeof embedProviderFlagKey>[0],
              )
            ] ?? true,
          hint: id,
        };
      }),
    [embedSections.dual, flags],
  );

  const previewScrapeProviders = useMemo(() => {
    const providers =
      previewMode === "proxy-anime"
        ? buildGroupedAnimePlaybackProviderOptions(ANIME_PREVIEW_CONTEXT, {
            animeOrder:
              menuOrder.animeScrape as typeof ANIME_SCRAPE_PROVIDER_ORDER,
            tmdbOrder:
              menuOrder.tmdbScrape as typeof TMDB_SCRAPE_PROVIDER_ORDER,
          })
        : menuOrder.tmdbScrape.map((providerId) => ({
            providerId,
            name:
              TMDB_SCRAPE_PROVIDER_LABELS[
                providerId as keyof typeof TMDB_SCRAPE_PROVIDER_LABELS
              ] ?? providerId,
          }));

    return providers.filter((provider) => {
      if ("group" in provider && provider.group === "anime") {
        return isAnimeScrapeProviderEnabled(previewFlags, provider.providerId);
      }
      return isTmdbScrapeProviderEnabled(previewFlags, provider.providerId);
    });
  }, [menuOrder.animeScrape, menuOrder.tmdbScrape, previewFlags, previewMode]);

  return (
    <Card className="border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="text-lg">Server menu order</CardTitle>
        <CardDescription>
          Drag to reorder how sources appear in the server selector. Disabled
          providers stay in the list but won&apos;t show to users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="rounded-xl border border-white/10 bg-zinc-950/80 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Live preview</p>
              <p className="text-xs text-white/50">
                Uses the real server selector with your draft flags and order.
              </p>
            </div>
            <div
              role="tablist"
              aria-label="Preview playback mode"
              className="flex flex-wrap gap-1 rounded-lg bg-white/5 p-1"
            >
              {(
                [
                  ["proxy-movie", "Proxy · movie"],
                  ["proxy-anime", "Proxy · anime"],
                  ["iframe", "Iframe"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={previewMode === mode}
                  onClick={() => setPreviewMode(mode)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
                    previewMode === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-white/60 hover:text-white",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <FeatureFlagsProvider flags={previewFlags}>
            <div className="flex justify-end rounded-lg bg-gradient-to-br from-zinc-800/80 to-zinc-900 p-6">
              <ServerSelector
                key={previewMode}
                previewVariant={previewMode}
                previewDefaultOpen
                previewSuppressProxyHint
                scrapeProviders={previewScrapeProviders}
                onSelectScrapeProvider={() => undefined}
              />
            </div>
          </FeatureFlagsProvider>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white/90">
                Proxy · TMDB
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-white/15 bg-transparent text-xs"
                onClick={() =>
                  onMenuOrderChange({
                    ...menuOrder,
                    tmdbScrape: [...DEFAULT_PROVIDER_MENU_ORDER.tmdbScrape],
                  })
                }
              >
                Reset
              </Button>
            </div>
            <SortableProviderList
              items={tmdbItems}
              onReorder={(next) =>
                onMenuOrderChange({ ...menuOrder, tmdbScrape: next })
              }
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white/90">
                Proxy · anime
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-white/15 bg-transparent text-xs"
                onClick={() =>
                  onMenuOrderChange({
                    ...menuOrder,
                    animeScrape: [...DEFAULT_PROVIDER_MENU_ORDER.animeScrape],
                  })
                }
              >
                Reset
              </Button>
            </div>
            <SortableProviderList
              items={animeItems}
              onReorder={(next) =>
                onMenuOrderChange({ ...menuOrder, animeScrape: next })
              }
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white/90">
              Iframe / embed
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-white/15 bg-transparent text-xs"
              onClick={() =>
                onMenuOrderChange({
                  ...menuOrder,
                  embed: [...DEFAULT_PROVIDER_MENU_ORDER.embed],
                })
              }
            >
              Reset all
            </Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <SortableProviderList
              sectionLabel="Main iframe list"
              sectionHint="Shown directly in the iframe tab."
              items={embedOnlyItems}
              onReorder={(next) =>
                onMenuOrderChange({
                  ...menuOrder,
                  embed: mergeEmbedOrder(next, embedSections.dual),
                })
              }
            />
            <SortableProviderList
              sectionLabel="More embed servers"
              sectionHint='Behind the "More embed servers" submenu.'
              items={dualEmbedItems}
              onReorder={(next) =>
                onMenuOrderChange({
                  ...menuOrder,
                  embed: mergeEmbedOrder(embedSections.embedOnly, next),
                })
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
