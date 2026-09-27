"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type HeroBackdropCandidate,
  type HeroBackdropOption,
} from "@/lib/flags/hero-backdrop-candidates";
import {
  heroBackdropOverrideKey,
  heroBackdropPreviewUrl,
  isAllowedHeroBackdropPath,
  patchHeroBackdropOverride,
  removeHeroBackdropOverride,
  upsertHeroBackdropOverride,
  type HeroBackdropOverrideEntry,
  type HeroBackdropOverridesConfig,
  type HeroBackdropOverrideSource,
} from "@/lib/flags/hero-backdrop-overrides";
import {
  canAddFeaturedPinForHub,
  featuredPinCountForHub,
  HERO_FEATURED_MAX_ITEMS,
  hubKindToMediaType,
  reorderHeroBackdropOverride,
  selectFeaturedEntriesForHub,
  type HeroFeaturedHubKind,
} from "@/lib/flags/hero-featured-items";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Loader2,
  Search,
  Trash2,
  Tv,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type HeroBackdropPanelProps = {
  overrides: HeroBackdropOverridesConfig;
  onOverridesChange: (next: HeroBackdropOverridesConfig) => void;
  previewSyncToken?: number;
};

type PreviewState = {
  path: string;
  title: string;
  source: HeroBackdropOverrideSource;
};

type HubTab = {
  kind: HeroFeaturedHubKind;
  label: string;
  routes: string;
  placeholder: string;
};

const HUB_TABS: HubTab[] = [
  {
    kind: "movie",
    label: "Movies",
    routes: "Home · Movies · Trending",
    placeholder: "Dune: Part Three",
  },
  {
    kind: "tv",
    label: "TV",
    routes: "/tvshows",
    placeholder: "Severance",
  },
  {
    kind: "anime",
    label: "Anime",
    routes: "/anime",
    placeholder: "Frieren",
  },
];

const SOURCE_LABELS: Record<HeroBackdropOverrideSource, string> = {
  tmdb: "TMDB",
  anilist: "AniList",
  mal: "MAL",
  custom: "Custom",
};

const MEDIA_ICONS = {
  movie: Film,
  tv: Tv,
  anime: Clapperboard,
} as const;

const mediaIcon = (mediaType: HeroBackdropCandidate["mediaType"]) =>
  MEDIA_ICONS[mediaType] ?? Film;

const candidateToPreview = (
  candidate: HeroBackdropCandidate,
  option: HeroBackdropOption,
): PreviewState => ({
  path: option.path,
  title: candidate.title,
  source: option.source,
});

const entryToPreview = (entry: HeroBackdropOverrideEntry): PreviewState => ({
  path: entry.path,
  title: entry.title,
  source: entry.source,
});

const buildEntry = (
  candidate: HeroBackdropCandidate,
  option: HeroBackdropOption,
  hubKind: HeroFeaturedHubKind,
): HeroBackdropOverrideEntry => {
  const mediaType = hubKindToMediaType(hubKind);
  return {
    key: heroBackdropOverrideKey(mediaType, {
      tmdbId: candidate.tmdbId,
      anilistId: candidate.anilistId,
      malId: candidate.malId,
    }),
    mediaType,
    title: candidate.title,
    tmdbId: candidate.tmdbId,
    anilistId: candidate.anilistId,
    malId: candidate.malId,
    path: option.path,
    source: option.source,
    label: option.label,
    updatedAt: new Date().toISOString(),
  };
};

const idChips = (candidate: HeroBackdropCandidate) => {
  const chips: string[] = [];
  if (candidate.tmdbId) chips.push(`TMDB ${candidate.tmdbId}`);
  if (candidate.anilistId) chips.push(`AniList ${candidate.anilistId}`);
  if (candidate.malId) chips.push(`MAL ${candidate.malId}`);
  return chips;
};

const BackdropOptionGrid = ({
  options,
  activePath,
  disabled = false,
  idPrefix,
  onSelect,
  onPreview,
}: {
  options: HeroBackdropOption[];
  activePath: string | null;
  disabled?: boolean;
  idPrefix: string;
  onSelect: (option: HeroBackdropOption) => void;
  onPreview: (option: HeroBackdropOption) => void;
}) => (
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    {options.map((option) => {
      const selected = activePath === option.path;
      return (
        <button
          key={`${idPrefix}-${option.path}`}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option)}
          onMouseEnter={() => onPreview(option)}
          onFocus={() => onPreview(option)}
          className={cn(
            "relative aspect-video overflow-hidden rounded-md border bg-black outline-hidden transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40",
            selected
              ? "border-foreground"
              : "border-border hover:border-muted-foreground/50",
          )}
        >
          <img
            src={option.previewUrl}
            alt={option.label}
            loading="lazy"
            className="size-full object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 to-transparent px-2 pb-1.5 pt-5 text-left text-[10px] text-white/85">
            {option.label}
          </span>
          {selected ? (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-sm bg-foreground text-background">
              <Check className="size-2.5" aria-hidden />
            </span>
          ) : null}
        </button>
      );
    })}
  </div>
);

const withCurrentBackdrop = (
  entry: HeroBackdropOverrideEntry,
  options: readonly HeroBackdropOption[],
): HeroBackdropOption[] => {
  if (options.some((option) => option.path === entry.path)) {
    return [...options];
  }

  return [
    {
      path: entry.path,
      previewUrl: heroBackdropPreviewUrl(entry.path, "w780"),
      label: entry.label || "Current",
      source: entry.source,
      width: null,
      height: null,
    },
    ...options,
  ];
};

export function HeroBackdropPanel({
  overrides,
  onOverridesChange,
  previewSyncToken = 0,
}: HeroBackdropPanelProps) {
  const [hub, setHub] = useState<HeroFeaturedHubKind>("movie");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HeroBackdropCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [openCandidate, setOpenCandidate] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [editorOptions, setEditorOptions] = useState<HeroBackdropOption[]>([]);
  const [editorStatus, setEditorStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [editorHoverPath, setEditorHoverPath] = useState<string | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;

  const hubTab = HUB_TABS.find((tab) => tab.kind === hub) ?? HUB_TABS[0];
  const hubEntries = useMemo(
    () => selectFeaturedEntriesForHub(overrides, hub),
    [overrides, hub],
  );
  const hubPinCount = hubEntries.length;
  const hubAtCapacity = !canAddFeaturedPinForHub(overrides, hub);

  const syncPreviewToHub = (
    config: HeroBackdropOverridesConfig,
    hubKind: HeroFeaturedHubKind,
  ) => {
    const first = selectFeaturedEntriesForHub(config, hubKind)[0];
    setPreview(first ? entryToPreview(first) : null);
  };

  useEffect(() => {
    syncPreviewToHub(overridesRef.current, hub);
    setEditorKey(null);
  }, [hub]);

  useEffect(() => {
    if (previewSyncToken === 0) return;
    syncPreviewToHub(overridesRef.current, hub);
  }, [previewSyncToken, hub]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      searchAbort.current?.abort();
      setResults([]);
      setSearching(false);
      setSearched(false);
      setOpenCandidate(null);
      return;
    }

    const controller = new AbortController();
    searchAbort.current?.abort();
    searchAbort.current = controller;
    setSearching(true);

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/ffs/hero-backdrops?query=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = (await res.json()) as {
          results: HeroBackdropCandidate[];
        };
        if (controller.signal.aborted) return;
        setResults(data.results ?? []);
        setSearched(true);
        setOpenCandidate(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults([]);
        setSearched(true);
        setOpenCandidate(null);
        toast.error(error instanceof Error ? error.message : "Search failed");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const editingEntry = useMemo(
    () => overrides.entries.find((entry) => entry.key === editorKey) ?? null,
    [overrides.entries, editorKey],
  );

  useEffect(() => {
    if (!editorKey) return;
    const entry = overridesRef.current.entries.find(
      (item) => item.key === editorKey,
    );
    if (!entry) {
      setEditorKey(null);
      return;
    }

    const controller = new AbortController();
    setEditorStatus("loading");
    setEditorOptions([]);
    setEditorHoverPath(null);

    const params = new URLSearchParams({
      options: "1",
      mediaType: entry.mediaType,
      title: entry.title,
    });
    if (entry.tmdbId) params.set("tmdbId", String(entry.tmdbId));
    if (entry.anilistId) params.set("anilistId", String(entry.anilistId));
    if (entry.malId) params.set("malId", String(entry.malId));

    const loadOptions = async () => {
      try {
        const res = await fetch(`/api/ffs/hero-backdrops?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Couldn't load images (${res.status})`);
        const data = (await res.json()) as {
          backdrops?: HeroBackdropOption[];
        };
        if (controller.signal.aborted) return;
        setEditorOptions(data.backdrops ?? []);
        setEditorStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setEditorOptions([]);
        setEditorStatus("error");
        toast.error(
          error instanceof Error ? error.message : "Couldn't load images",
        );
      }
    };

    void loadOptions();

    return () => controller.abort();
  }, [editorKey]);

  const editorChoices = useMemo(
    () =>
      editingEntry ? withCurrentBackdrop(editingEntry, editorOptions) : [],
    [editingEntry, editorOptions],
  );

  const activePathFor = (candidate: HeroBackdropCandidate) => {
    const mediaType = hubKindToMediaType(hub);
    const key = heroBackdropOverrideKey(mediaType, {
      tmdbId: candidate.tmdbId,
      anilistId: candidate.anilistId,
      malId: candidate.malId,
    });
    return overrides.entries.find((entry) => entry.key === key)?.path ?? null;
  };

  const applyOption = (
    candidate: HeroBackdropCandidate,
    option: HeroBackdropOption,
  ) => {
    const mediaType = hubKindToMediaType(hub);
    const key = heroBackdropOverrideKey(mediaType, {
      tmdbId: candidate.tmdbId,
      anilistId: candidate.anilistId,
      malId: candidate.malId,
    });
    const isUpdate = overrides.entries.some((entry) => entry.key === key);

    if (!isUpdate && !canAddFeaturedPinForHub(overrides, hub)) {
      toast.error(
        `${hubTab.label} already has ${HERO_FEATURED_MAX_ITEMS} pins`,
      );
      return;
    }

    const entry = buildEntry(candidate, option, hub);
    onOverridesChange(upsertHeroBackdropOverride(overrides, entry));
    setPreview(candidateToPreview(candidate, option));
    toast.success(`${candidate.title} pinned to ${hubTab.label} hero`);
  };

  const applyCustomUrl = (candidate: HeroBackdropCandidate) => {
    const value = (customUrls[candidate.id] ?? "").trim();
    if (!isAllowedHeroBackdropPath(value)) {
      toast.error(
        "Enter a valid https URL or a TMDB file path starting with /",
      );
      return;
    }
    applyOption(candidate, {
      path: value,
      previewUrl: heroBackdropPreviewUrl(value, "w780"),
      label: "Custom URL",
      source: "custom",
      width: null,
      height: null,
    });
    setCustomUrls((current) => ({ ...current, [candidate.id]: "" }));
  };

  const applyEntryOption = (
    entry: HeroBackdropOverrideEntry,
    option: HeroBackdropOption,
  ) => {
    setEditorHoverPath(null);
    if (entry.path === option.path) return;
    onOverridesChange(
      patchHeroBackdropOverride(overrides, entry.key, {
        path: option.path,
        source: option.source,
        label: option.label,
      }),
    );
    setPreview({
      path: option.path,
      title: entry.title,
      source: option.source,
    });
  };

  const applyEditorCustomUrl = (entry: HeroBackdropOverrideEntry) => {
    const value = (customUrls[entry.key] ?? "").trim();
    if (!isAllowedHeroBackdropPath(value)) {
      toast.error(
        "Enter a valid https URL or a TMDB file path starting with /",
      );
      return;
    }
    applyEntryOption(entry, {
      path: value,
      previewUrl: heroBackdropPreviewUrl(value, "w780"),
      label: "Custom URL",
      source: "custom",
      width: null,
      height: null,
    });
    setCustomUrls((current) => ({ ...current, [entry.key]: "" }));
  };

  const removeEntry = (entry: HeroBackdropOverrideEntry) => {
    if (editorKey === entry.key) setEditorKey(null);
    onOverridesChange(removeHeroBackdropOverride(overrides, entry.key));
    if (preview?.path === entry.path) {
      const next = selectFeaturedEntriesForHub(
        removeHeroBackdropOverride(overrides, entry.key),
        hub,
      )[0];
      setPreview(next ? entryToPreview(next) : null);
    }
    toast.success("Pin removed");
  };

  const moveEntry = (
    entry: HeroBackdropOverrideEntry,
    direction: "up" | "down",
  ) => {
    onOverridesChange(
      reorderHeroBackdropOverride(overrides, entry.key, direction),
    );
  };

  const canMoveEntry = (
    entry: HeroBackdropOverrideEntry,
    direction: "up" | "down",
  ) => {
    const index = overrides.entries.findIndex((item) => item.key === entry.key);
    if (index === -1) return false;

    if (direction === "up") {
      return overrides.entries
        .slice(0, index)
        .some((item) => item.mediaType === entry.mediaType);
    }

    return overrides.entries
      .slice(index + 1)
      .some((item) => item.mediaType === entry.mediaType);
  };

  const previewImageUrl = preview
    ? heroBackdropPreviewUrl(preview.path, "w1280")
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <ToggleGroup
          type="single"
          variant="quiet"
          size="sm"
          value={hub}
          onValueChange={(value) => {
            if (value) setHub(value as HeroFeaturedHubKind);
          }}
          aria-label="Index hero hub"
          className="flex-wrap justify-start"
        >
          {HUB_TABS.map((tab) => {
            const count = featuredPinCountForHub(overrides, tab.kind);
            return (
              <ToggleGroupItem
                key={tab.kind}
                value={tab.kind}
                className="h-8 gap-1.5 px-2.5 text-xs"
              >
                {tab.label}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {count}/{HERO_FEATURED_MAX_ITEMS}
                </span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          Pins for <span className="text-foreground">{hubTab.label}</span> apply
          to {hubTab.routes}. Search any title, then pin it to the selected hub.
          Up to {HERO_FEATURED_MAX_ITEMS} pins lead the hero; open slots fill
          with automatic picks after save.
        </p>
      </div>

      <section
        aria-labelledby="hero-backdrop-preview-heading"
        className="space-y-2"
      >
        <div className="flex items-center gap-2">
          <h4
            id="hero-backdrop-preview-heading"
            className="text-xs font-medium text-foreground"
          >
            {hubTab.label} preview
          </h4>
          {preview ? (
            <Badge variant="outline" className="ml-auto text-[10px] uppercase">
              {SOURCE_LABELS[preview.source]}
            </Badge>
          ) : null}
        </div>

        <div className="relative overflow-hidden rounded-md border border-border">
          <div className="relative aspect-video w-full">
            {previewImageUrl ? (
              <img
                src={previewImageUrl}
                alt={preview?.title ? `${preview.title} hero` : "Hero preview"}
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageIcon className="size-5" aria-hidden />
                <p className="px-6 text-center text-xs">
                  No {hubTab.label.toLowerCase()} pins yet. Search below to add
                  one.
                </p>
              </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
            {preview ? (
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="text-sm font-medium text-white">
                  {preview.title}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-white/60">
                  {preview.path}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="hero-backdrop-search" className="text-xs font-medium">
            Add pin
          </Label>
          {hubAtCapacity ? (
            <span className="text-[11px] text-muted-foreground">
              {HERO_FEATURED_MAX_ITEMS}/{HERO_FEATURED_MAX_ITEMS} slots used
            </span>
          ) : null}
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="hero-backdrop-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={hubTab.placeholder}
            aria-label="Search titles to pin"
            className="h-8 border-border bg-transparent pl-9 text-sm shadow-none"
            autoComplete="off"
          />
          {searching ? (
            <Loader2
              className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : null}
        </div>

        {searched && results.length === 0 ? (
          <p className="border border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No titles matched that search.
          </p>
        ) : null}

        {results.length > 0 ? (
          <Accordion
            type="single"
            collapsible
            value={openCandidate ?? undefined}
            onValueChange={(value) => setOpenCandidate(value || null)}
            className="rounded-md border border-border px-3"
          >
            {results.map((candidate) => {
              const MediaIcon = mediaIcon(candidate.mediaType);
              const chips = idChips(candidate);
              const activePath = activePathFor(candidate);
              const isPinned = Boolean(activePath);
              const pinsToOtherHub =
                candidate.mediaType !== hubKindToMediaType(hub);
              return (
                <AccordionItem
                  key={candidate.id}
                  value={candidate.id}
                  className="last:border-b-0"
                >
                  <AccordionTrigger className="gap-3 py-3 hover:no-underline">
                    <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="relative aspect-poster w-9 shrink-0 overflow-hidden rounded-sm border border-border bg-muted/20">
                        {candidate.posterUrl ? (
                          <img
                            src={candidate.posterUrl}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <MediaIcon
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="truncate text-sm text-foreground">
                            {candidate.title}
                          </span>
                          {candidate.year ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {candidate.year}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="uppercase tracking-wide">
                            {candidate.subtitle}
                          </span>
                          {chips.map((chip) => (
                            <span
                              key={chip}
                              className="rounded-sm bg-muted/40 px-1.5 py-0.5 font-mono"
                            >
                              {chip}
                            </span>
                          ))}
                          {isPinned ? (
                            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                              <Check className="size-2.5" aria-hidden />
                              Pinned
                            </span>
                          ) : pinsToOtherHub ? (
                            <span className="font-medium text-foreground">
                              Pins to {hubTab.label}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    {candidate.backdrops.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No preset images found. Paste a custom URL below.
                      </p>
                    ) : (
                      <BackdropOptionGrid
                        options={candidate.backdrops}
                        activePath={activePath}
                        disabled={hubAtCapacity && !isPinned}
                        idPrefix={candidate.id}
                        onSelect={(option) => applyOption(candidate, option)}
                        onPreview={(option) =>
                          setPreview(candidateToPreview(candidate, option))
                        }
                      />
                    )}

                    <div className="space-y-2 border border-border p-3">
                      <Label
                        htmlFor={`custom-url-${candidate.id}`}
                        className="text-xs"
                      >
                        Custom image URL
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`custom-url-${candidate.id}`}
                          value={customUrls[candidate.id] ?? ""}
                          onChange={(event) =>
                            setCustomUrls((current) => ({
                              ...current,
                              [candidate.id]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              applyCustomUrl(candidate);
                            }
                          }}
                          placeholder="https://… or /backdrop.jpg"
                          disabled={hubAtCapacity && !isPinned}
                          className="h-8 border-border bg-transparent font-mono text-xs shadow-none"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={hubAtCapacity && !isPinned}
                          className="h-8 shrink-0 border-border bg-transparent shadow-none"
                          onClick={() => applyCustomUrl(candidate)}
                        >
                          Use
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="text-xs font-medium text-foreground">
            {hubTab.label} pins
            <span className="ml-2 font-normal text-muted-foreground">
              ({hubPinCount}/{HERO_FEATURED_MAX_ITEMS})
            </span>
          </h4>
          {hubPinCount > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Click an image to change it
            </p>
          ) : null}
        </div>
        {hubPinCount === 0 ? (
          <p className="border border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No {hubTab.label.toLowerCase()} pins yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {hubEntries.map((entry) => (
              <li
                key={entry.key}
                className="flex items-center gap-3 px-2 py-2 transition-colors duration-150 hover:bg-muted/40 motion-reduce:transition-none"
              >
                <button
                  type="button"
                  onClick={() => {
                    setPreview(entryToPreview(entry));
                    setEditorKey(entry.key);
                  }}
                  className="group relative aspect-video w-20 shrink-0 overflow-hidden rounded-sm border border-border bg-black outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label={`Change backdrop for ${entry.title}`}
                  aria-haspopup="dialog"
                >
                  <img
                    src={heroBackdropPreviewUrl(entry.path, "w780")}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-end bg-linear-to-t from-black/80 to-transparent p-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                    <span className="text-[10px] font-medium text-white">
                      Change
                    </span>
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {entry.title}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {entry.label}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Move ${entry.title} up`}
                    disabled={!canMoveEntry(entry, "up")}
                    onClick={() => moveEntry(entry, "up")}
                    className="size-7 text-muted-foreground"
                  >
                    <ChevronUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Move ${entry.title} down`}
                    disabled={!canMoveEntry(entry, "down")}
                    onClick={() => moveEntry(entry, "down")}
                    className="size-7 text-muted-foreground"
                  >
                    <ChevronDown className="size-4" aria-hidden />
                  </Button>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${entry.title} pin`}
                  onClick={() => removeEntry(entry)}
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={Boolean(editingEntry)}
        onOpenChange={(open) => {
          if (!open) setEditorKey(null);
        }}
      >
        {editingEntry ? (
          <DialogContent className="max-h-[min(880px,calc(100vh-2rem))] max-w-3xl overflow-y-auto border-border bg-background p-4 sm:p-5">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-base">
                {editingEntry.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Pick a different image for this pin. The order stays put.
              </DialogDescription>
            </DialogHeader>

            <div className="relative overflow-hidden rounded-md border border-border">
              <div className="relative aspect-video w-full bg-black">
                <img
                  src={heroBackdropPreviewUrl(
                    editorHoverPath ?? editingEntry.path,
                    "w1280",
                  )}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-3">
                  <p className="text-xs text-white/80">
                    {editorChoices.find(
                      (option) =>
                        option.path === (editorHoverPath ?? editingEntry.path),
                    )?.label ?? editingEntry.label}
                  </p>
                </div>
              </div>
            </div>

            {editorStatus === "loading" ? (
              <div
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                aria-hidden
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="aspect-video animate-pulse rounded-md bg-muted/40"
                  />
                ))}
              </div>
            ) : (
              <div
                onMouseLeave={() => setEditorHoverPath(null)}
                onBlur={(event) => {
                  const next = event.relatedTarget;
                  if (
                    next instanceof Node &&
                    event.currentTarget.contains(next)
                  ) {
                    return;
                  }
                  setEditorHoverPath(null);
                }}
              >
                <BackdropOptionGrid
                  options={editorChoices}
                  activePath={editingEntry.path}
                  idPrefix={editingEntry.key}
                  onSelect={(option) => applyEntryOption(editingEntry, option)}
                  onPreview={(option) => setEditorHoverPath(option.path)}
                />
              </div>
            )}

            {editorStatus === "error" ? (
              <p className="text-xs text-muted-foreground">
                The other images didn&apos;t load. The current one is still
                here, or paste a URL below.
              </p>
            ) : null}

            <div className="space-y-2 border border-border p-3">
              <Label
                htmlFor={`pin-custom-url-${editingEntry.key}`}
                className="text-xs"
              >
                Custom image URL
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`pin-custom-url-${editingEntry.key}`}
                  value={customUrls[editingEntry.key] ?? ""}
                  onChange={(event) =>
                    setCustomUrls((current) => ({
                      ...current,
                      [editingEntry.key]: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyEditorCustomUrl(editingEntry);
                    }
                  }}
                  placeholder="https://… or /backdrop.jpg"
                  className="h-8 border-border bg-transparent font-mono text-xs shadow-none"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 border-border bg-transparent shadow-none"
                  onClick={() => applyEditorCustomUrl(editingEntry)}
                >
                  Use
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
