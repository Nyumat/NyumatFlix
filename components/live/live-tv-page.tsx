"use client";

import { QueueListIcon } from "@vidstack/react/icons";
import { CalendarClock, Clock } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LiveTvPlayer } from "@/components/live/live-tv-player";
import {
  getChannelShareSlug,
  resolveChannelFromSlug,
} from "@/lib/live/channel-slugs";
import { pickDefaultLiveChannel } from "@/lib/live/defaults";
import { EMPTY_LIVE_GUIDE } from "@/lib/live/empty-guide";
import { mergeLiveChannelGuides } from "@/lib/live/guide-utils";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES = "all";
const DEFAULT_DOCUMENT_TITLE = "Live TV | NyumatFlix";

type LiveTvPageProps = {
  initialChannelSlug?: string | null;
};

const formatEventTime = (value: string | null) => {
  if (!value) {
    return "Live";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return "Live";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
};

const resolveInitialChannelId = (
  guide: LiveChannelsResponse,
  initialChannelSlug?: string | null,
) => {
  if (initialChannelSlug) {
    const resolved = resolveChannelFromSlug(initialChannelSlug, guide.channels);

    if (resolved?.playUrl) {
      return resolved.id;
    }
  }

  return pickDefaultLiveChannel(guide.channels)?.id ?? null;
};

const fetchLiveGuide = async (mode: "bootstrap" | "supplemental" | "full") => {
  const url =
    mode === "bootstrap"
      ? "/api/live/channels?bootstrap=1"
      : mode === "supplemental"
        ? "/api/live/channels?supplemental=1"
        : "/api/live/channels";
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Live guide returned ${response.status}`);
  }

  const guide = (await response.json()) as LiveChannelsResponse;

  if (guide.channels.length === 0) {
    throw new Error("Live guide returned no channels");
  }

  return guide;
};

const replaceLiveChannelUrl = (slug: string) => {
  const url = `/live?ch=${encodeURIComponent(slug)}`;
  window.history.replaceState(window.history.state, "", url);
};

export function LiveTvPage({ initialChannelSlug = null }: LiveTvPageProps) {
  const initialChannelSlugRef = useRef(initialChannelSlug);
  const [guide, setGuide] = useState(EMPTY_LIVE_GUIDE);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );
  const [loadingGuide, setLoadingGuide] = useState(true);
  const [loadingMoreChannels, setLoadingMoreChannels] = useState(false);
  const [guideError, setGuideError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fullGuideLoadedRef = useRef(false);

  const selectedChannel = useMemo(
    () =>
      guide.channels.find((channel) => channel.id === selectedChannelId) ??
      pickDefaultLiveChannel(guide.channels),
    [guide.channels, selectedChannelId],
  );

  const filteredChannels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return guide.channels.filter((channel) => {
      const matchesCategory =
        category === ALL_CATEGORIES || channel.category === category;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        channel.searchText.includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [category, guide.channels, query]);

  const liveEvents = useMemo(
    () =>
      guide.channels.filter((channel) => channel.kind === "event").slice(0, 4),
    [guide.channels],
  );

  useEffect(() => {
    document.title = selectedChannel
      ? `${selectedChannel.name} Live | NyumatFlix`
      : DEFAULT_DOCUMENT_TITLE;
  }, [selectedChannel]);

  const applyGuide = useCallback(
    (nextGuide: LiveChannelsResponse, merge = false) => {
      setGuide((currentGuide) => {
        const resolvedGuide = merge
          ? mergeLiveChannelGuides(currentGuide, nextGuide)
          : nextGuide;

        setSelectedChannelId((currentId) => {
          if (
            currentId &&
            resolvedGuide.channels.some((channel) => channel.id === currentId)
          ) {
            return currentId;
          }

          return resolveInitialChannelId(
            resolvedGuide,
            initialChannelSlugRef.current,
          );
        });

        return resolvedGuide;
      });
      setGuideError(false);
    },
    [],
  );

  const loadSupplementalGuide = useCallback(async () => {
    const supplementalGuide = await fetchLiveGuide("supplemental");
    applyGuide(supplementalGuide, true);
    fullGuideLoadedRef.current = true;
  }, [applyGuide]);

  useEffect(() => {
    let cancelled = false;

    const bootstrapGuide = async () => {
      setLoadingGuide(true);
      fullGuideLoadedRef.current = false;

      try {
        const initialGuide = await fetchLiveGuide("bootstrap");
        if (cancelled) {
          return;
        }

        applyGuide(initialGuide);

        if (initialGuide.guideComplete === false) {
          setLoadingMoreChannels(true);

          try {
            await loadSupplementalGuide();
          } catch {
            // Supplemental guide load is best-effort once bootstrap succeeded.
          } finally {
            if (!cancelled) {
              setLoadingMoreChannels(false);
            }
          }
        } else {
          fullGuideLoadedRef.current = true;
        }
      } catch {
        if (cancelled) {
          return;
        }

        try {
          await loadSupplementalGuide();
        } catch {
          try {
            await fetchLiveGuide("full").then((guide) => applyGuide(guide));
          } catch {
            if (!cancelled) {
              setGuideError(true);
            }
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingGuide(false);
          setLoadingMoreChannels(false);
        }
      }
    };

    void bootstrapGuide();

    return () => {
      cancelled = true;
    };
  }, [applyGuide, loadSupplementalGuide]);

  const refreshGuide = useCallback(async () => {
    setRefreshing(true);
    fullGuideLoadedRef.current = false;

    try {
      const bootstrapGuide = await fetchLiveGuide("bootstrap");
      applyGuide(bootstrapGuide);

      if (bootstrapGuide.guideComplete === false) {
        setLoadingMoreChannels(true);
        await loadSupplementalGuide();
      } else {
        fullGuideLoadedRef.current = true;
      }
    } catch {
      try {
        const fullGuide = await fetchLiveGuide("full");
        applyGuide(fullGuide);
      } catch {
        setGuideError(true);
      }
    } finally {
      setRefreshing(false);
      setLoadingMoreChannels(false);
    }
  }, [applyGuide, loadSupplementalGuide]);

  const selectChannel = (channel: LiveChannel) => {
    if (!channel.playUrl) {
      return;
    }

    setSelectedChannelId(channel.id);
    replaceLiveChannelUrl(getChannelShareSlug(channel));
  };

  return (
    <div className="container space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          Live Television
        </h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground sm:text-base">
          Tap the
          <QueueListIcon className="inline-block size-4 text-foreground" />
          channels icon to browse everything.
        </p>
      </header>

      {loadingGuide ? (
        <LiveGuideLoadingState />
      ) : guideError ? (
        <LiveGuideErrorState onRetry={refreshGuide} retrying={refreshing} />
      ) : (
        <LiveTvPlayer
          categories={guide.categories}
          channels={filteredChannels}
          loadingMoreChannels={loadingMoreChannels}
          onCategoryChange={setCategory}
          onRefresh={refreshGuide}
          onQueryChange={setQuery}
          onSelectChannel={selectChannel}
          playUrl={selectedChannel?.playUrl ?? null}
          poster={selectedChannel?.logoUrl}
          query={query}
          refreshing={refreshing}
          selectedCategory={category}
          selectedChannel={selectedChannel}
          selectedChannelId={selectedChannelId}
        />
      )}

      <UpNextStrip events={liveEvents} />
    </div>
  );
}

function LiveGuideLoadingState() {
  return (
    <div className="overflow-hidden rounded-[8px] border border-border bg-card/40 shadow-2xl shadow-black/35 backdrop-blur-md">
      <div className="flex aspect-video items-center justify-center bg-black text-sm text-muted-foreground">
        Loading live channels...
      </div>
    </div>
  );
}

function LiveGuideErrorState({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-border bg-card/40 p-8 text-center shadow-2xl shadow-black/35 backdrop-blur-md">
      <p className="text-sm text-muted-foreground">
        Live channels are taking longer than usual to load.
      </p>
      <button
        type="button"
        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        disabled={retrying}
        onClick={onRetry}
      >
        {retrying ? "Retrying..." : "Try again"}
      </button>
    </div>
  );
}

function UpNextStrip({ events }: { events: LiveChannel[] }) {
  const visibleEvents = events.slice(0, 4);

  if (visibleEvents.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[8px] border border-[#263544] bg-[#080d12]/95 p-4">
      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center">
        <h2 className="text-lg font-bold text-white">Up next</h2>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {visibleEvents.map((event, index) => (
            <div
              key={event.id}
              className="rounded-[8px] border border-[#263544] bg-[#101820] px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-1 size-2 rounded-full",
                    index === 0 ? "bg-red-400" : "bg-cyan-400",
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">
                    {event.name}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    {event.startsAt ? (
                      <Clock className="size-3" />
                    ) : (
                      <CalendarClock className="size-3" />
                    )}
                    {index === 0 ? "Live" : formatEventTime(event.startsAt)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
