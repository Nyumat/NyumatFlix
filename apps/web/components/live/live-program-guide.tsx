"use client";

import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getProgramPosition,
  GUIDE_WINDOW_MS,
  GUIDE_HORIZON_MS,
  HALF_HOUR_MS,
  isProgramOnNow,
} from "@/lib/live/program-guide";
import type {
  LiveChannel,
  LiveChannelsResponse,
  LiveProgram,
} from "@/lib/live/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;
const MAX_GUIDE_OFFSET = GUIDE_HORIZON_MS / GUIDE_WINDOW_MS - 1;
const formatTime = (time: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(time);

const formatGuideContext = (start: number, end: number, now: number) => {
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formatDay = (time: number) => {
    const date = new Date(time);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);
  };
  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZoneName: "short",
  });
  const formatZone = (time: number) =>
    formatter.formatToParts(time).find((part) => part.type === "timeZoneName")
      ?.value;
  const firstDay = formatDay(start);
  const lastDay = formatDay(end - 1);
  const firstZone = formatZone(start);
  const lastZone = formatZone(end - 1);
  const day = firstDay === lastDay ? firstDay : `${firstDay} – ${lastDay}`;
  const zone =
    firstZone === lastZone ? firstZone : `${firstZone} – ${lastZone}`;
  return {
    label: [day, zone].filter(Boolean).join(" · "),
    timeZone: formatter.resolvedOptions().timeZone,
  };
};

type Props = {
  channels: LiveChannel[];
  loadingMore?: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  categories: LiveChannelsResponse["categories"];
  selectedChannelId: string | null;
  onSelectChannel: (channel: LiveChannel) => void;
  query: string;
  onQueryChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
};

export function LiveProgramGuide({
  channels,
  loadingMore = false,
  refreshing,
  onRefresh,
  categories,
  selectedChannelId,
  onSelectChannel,
  query,
  onQueryChange,
  selectedCategory,
  onCategoryChange,
}: Props) {
  const [now, setNow] = useState(0);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<{
    channel: LiveChannel;
    program: LiveProgram;
  } | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const start =
    Math.floor(now / HALF_HOUR_MS) * HALF_HOUR_MS + offset * GUIDE_WINDOW_MS;
  const end = start + GUIDE_WINDOW_MS;
  const guideContext = now > 0 ? formatGuideContext(start, end, now) : null;
  const lastPage = Math.max(0, Math.ceil(channels.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = channels.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  return (
    <section
      aria-labelledby="live-guide-heading"
      className="mt-4 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <div className="mr-auto min-w-36">
          <h2 id="live-guide-heading" className="text-base font-semibold">
            TV guide
          </h2>
          <p
            className="min-h-4 text-xs text-muted-foreground"
            title={guideContext?.timeZone}
          >
            {guideContext?.label}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous two hours"
            disabled={offset === 0}
            onClick={() => setOffset((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant={offset === 0 ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setOffset(0)}
          >
            Now
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next two hours"
            disabled={offset >= MAX_GUIDE_OFFSET}
            onClick={() =>
              setOffset((value) => Math.min(MAX_GUIDE_OFFSET, value + 1))
            }
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh channels"
            disabled={refreshing}
            onClick={onRefresh}
          >
            <RefreshCw
              className={cn("size-4", refreshing && "motion-safe:animate-spin")}
            />
          </Button>
        </div>
        <div className="relative w-full min-w-0 sm:w-52">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Search TV guide"
            placeholder="Search channels"
            className="pl-9"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <Select
          value={selectedCategory}
          onValueChange={(value) => {
            onCategoryChange(value);
            setPage(0);
          }}
        >
          <SelectTrigger aria-label="Guide category" className="w-full sm:w-40">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {detail ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 p-4"
          role="region"
          aria-label="Program details"
        >
          <div className="min-w-0 flex-1 basis-80">
            <p className="text-xs text-muted-foreground">
              {detail.channel.name} ·{" "}
              {formatTime(Date.parse(detail.program.startsAt))} –{" "}
              {formatTime(Date.parse(detail.program.endsAt))}
            </p>
            <h3 className="mt-1 font-semibold">
              {detail.program.title}
              {detail.program.episodeTitle
                ? ` · ${detail.program.episodeTitle}`
                : ""}
            </h3>
            {detail.program.description ? (
              <p className="mt-1 max-h-16 overflow-y-auto text-sm text-muted-foreground">
                {detail.program.description}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onSelectChannel(detail.channel)}>
              Watch channel live
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDetail(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
      {now === 0 ? (
        <p className="p-6 text-sm text-muted-foreground" role="status">
          Loading program times…
        </p>
      ) : channels.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          No channels match. Try another search or category.
        </p>
      ) : (
        <div
          className="max-h-[284px] overflow-auto overscroll-contain"
          tabIndex={0}
          role="region"
          aria-label="Channel schedule, scroll to browse"
        >
          <div className="min-w-[880px]">
            <div className="sticky top-0 z-20 flex h-11 border-b border-border bg-card text-xs font-medium">
              <div className="sticky left-0 z-30 w-44 shrink-0 border-r border-border bg-card px-4 py-3">
                Channel
              </div>
              <div className="relative flex flex-1">
                {[0, 1, 2, 3].map((tick) => (
                  <div
                    key={tick}
                    className="w-1/4 border-r border-border px-3 py-3 tabular-nums"
                  >
                    {formatTime(start + tick * HALF_HOUR_MS)}
                  </div>
                ))}
              </div>
            </div>
            {visible.map((channel) => {
              const programs = (channel.programs ?? []).flatMap((program) => {
                const position = getProgramPosition(program, start, end);
                return position ? [{ program, position }] : [];
              });
              const active = channel.id === selectedChannelId;
              return (
                <div
                  key={channel.id}
                  className="flex h-20 border-b border-border"
                >
                  <button
                    type="button"
                    aria-label={`Watch ${channel.name}`}
                    aria-pressed={active}
                    onClick={() => onSelectChannel(channel)}
                    className={cn(
                      "sticky left-0 z-10 flex w-44 shrink-0 flex-col justify-center border-r border-border bg-card px-4 text-left hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2",
                      active && "bg-primary/15 text-primary",
                    )}
                  >
                    <span className="line-clamp-2 text-sm font-semibold">
                      {channel.name}
                    </span>
                    <span className="mt-1 truncate text-xs text-muted-foreground">
                      {active ? "Watching now" : channel.categoryName}
                    </span>
                  </button>
                  <div className="relative min-w-0 flex-1 bg-muted/10">
                    {[1, 2, 3].map((tick) => (
                      <span
                        key={tick}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 border-l border-white/5"
                        style={{ left: `${tick * 25}%` }}
                      />
                    ))}
                    {offset === 0 && now >= start && now < end ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 z-10 border-l border-primary"
                        style={{
                          left: `${((now - start) / GUIDE_WINDOW_MS) * 100}%`,
                        }}
                      />
                    ) : null}
                    {programs.length ? (
                      programs.map(({ program, position }) => (
                        <button
                          key={program.id}
                          type="button"
                          onClick={() => setDetail({ channel, program })}
                          aria-label={`${program.title}, ${channel.name}, ${formatTime(Date.parse(program.startsAt))} to ${formatTime(Date.parse(program.endsAt))}`}
                          title={program.title}
                          className={cn(
                            "absolute inset-y-0 overflow-hidden border-r border-border bg-muted/25 px-4 text-left hover:bg-accent focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                            active &&
                              isProgramOnNow(program, now) &&
                              "border-primary/40 bg-primary/15",
                          )}
                          style={{
                            left: `${position.left}%`,
                            width: `${position.width}%`,
                          }}
                        >
                          <span className="block truncate text-sm font-medium">
                            {program.title}
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {program.episodeTitle &&
                            program.episodeTitle !== program.title
                              ? program.episodeTitle
                              : `${formatTime(Date.parse(program.startsAt))} – ${formatTime(Date.parse(program.endsAt))}`}
                          </span>
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectChannel(channel)}
                        className="flex h-full w-full items-center px-4 text-sm text-muted-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        Schedule unavailable
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
        {loadingMore ? (
          <span className="mr-auto text-xs text-muted-foreground" role="status">
            Loading channels…
          </span>
        ) : null}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous channels
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={currentPage >= lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            More channels
          </Button>
        </div>
      </div>
    </section>
  );
}
