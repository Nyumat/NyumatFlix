"use client";

import { QueueListIcon } from "@vidstack/react/icons";
import { CalendarClock, Clock } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { LiveTvPlayer } from "@/components/live/live-tv-player";
import { pickDefaultLiveChannel } from "@/lib/live/defaults";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES = "all";

type LiveTvPageProps = {
  initialGuide: LiveChannelsResponse;
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

export function LiveTvPage({ initialGuide }: LiveTvPageProps) {
  const [guide, setGuide] = useState(initialGuide);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [selectedChannelId, setSelectedChannelId] = useState(
    () => pickDefaultLiveChannel(initialGuide.channels)?.id ?? null,
  );
  const [refreshing, setRefreshing] = useState(false);

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

  const refreshGuide = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch("/api/live/channels", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Live guide returned ${response.status}`);
      }

      const nextGuide = (await response.json()) as LiveChannelsResponse;
      setGuide(nextGuide);

      if (
        selectedChannelId &&
        !nextGuide.channels.some((channel) => channel.id === selectedChannelId)
      ) {
        setSelectedChannelId(
          pickDefaultLiveChannel(nextGuide.channels)?.id ?? null,
        );
      }
    } catch {
      // Guide refresh is best-effort.
    } finally {
      setRefreshing(false);
    }
  }, [selectedChannelId]);

  const selectChannel = (channel: LiveChannel) => {
    if (!channel.playUrl) {
      return;
    }

    setSelectedChannelId(channel.id);
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

      <LiveTvPlayer
        categories={guide.categories}
        channels={filteredChannels}
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

      <UpNextStrip events={liveEvents} />
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
