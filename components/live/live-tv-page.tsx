"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LiveTvPlayer } from "@/components/live/live-tv-player";
import {
  getChannelShareSlug,
  resolveChannelFromSlug,
} from "@/lib/live/channel-slugs";
import { pickDefaultLiveChannel } from "@/lib/live/defaults";
import { EMPTY_LIVE_GUIDE } from "@/lib/live/empty-guide";
import {
  mergeLiveChannelGuides,
  toPlayableLiveGuide,
} from "@/lib/live/guide-utils";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";

const ALL_CATEGORIES = "all";
const DEFAULT_DOCUMENT_TITLE = "Live TV | NyumatFlix";

type LiveTvPageProps = {
  initialChannelSlug?: string | null;
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

  const playableGuide = useMemo(() => toPlayableLiveGuide(guide), [guide]);

  const selectedChannel = useMemo(
    () =>
      playableGuide.channels.find(
        (channel) => channel.id === selectedChannelId,
      ) ?? pickDefaultLiveChannel(playableGuide.channels),
    [playableGuide.channels, selectedChannelId],
  );

  const filteredChannels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return playableGuide.channels.filter((channel) => {
      const matchesCategory =
        category === ALL_CATEGORIES || channel.category === category;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        channel.searchText.includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [category, playableGuide.channels, query]);

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
    <div className="site-container space-y-8 md:space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          Live Television
        </h1>
      </header>

      {loadingGuide ? (
        <LiveGuideLoadingState />
      ) : guideError ? (
        <LiveGuideErrorState onRetry={refreshGuide} retrying={refreshing} />
      ) : (
        <LiveTvPlayer
          categories={playableGuide.categories}
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
