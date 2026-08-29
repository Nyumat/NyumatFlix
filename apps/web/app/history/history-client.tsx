"use client";

import { RecentlyWatchedCard } from "@/components/home/recently-watched-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWatchHistory } from "@/hooks/use-watch-history";
import type { RecentlyWatchedScope } from "@/lib/playback/recently-watched";
import Link from "next/link";
import { useState } from "react";

const HISTORY_SCOPES = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
  { value: "anime", label: "Anime" },
] as const satisfies ReadonlyArray<{
  value: RecentlyWatchedScope;
  label: string;
}>;

function HistoryGridFallback() {
  return (
    <div
      className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]"
      aria-hidden
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="aspect-video rounded-xs" />
      ))}
    </div>
  );
}

export function HistoryClient() {
  const [scope, setScope] = useState<RecentlyWatchedScope>("all");
  const { items, isLoading } = useWatchHistory(scope);

  return (
    <div className="relative mx-auto min-h-[calc(100vh-7rem)] w-full max-w-7xl px-4 pt-10 pb-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh] bg-linear-to-b from-black/80 via-black/70 to-transparent" />

      <div className="overflow-hidden rounded-lg border border-white/10 bg-background/82 shadow-xl shadow-black/20 backdrop-blur-xl">
        <div className="border-b border-white/10 px-4 py-5 md:px-6">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Watch History
            </h1>
            <p className="max-w-xl text-sm leading-5 text-zinc-300">
              Everything you have started on this device, plus synced progress
              when you are signed in.
            </p>
          </div>
        </div>

        <div className="border-b border-white/10 bg-white/[0.02] px-4 py-4 md:px-6">
          <Tabs
            value={scope}
            onValueChange={(value) => setScope(value as RecentlyWatchedScope)}
            className="w-full md:w-auto"
          >
            <TabsList className="h-9 w-full rounded-md bg-black/35 p-1 md:w-auto">
              {HISTORY_SCOPES.map((entry) => (
                <TabsTrigger
                  key={entry.value}
                  value={entry.value}
                  className="h-7 flex-1 rounded-sm px-3 text-sm data-[state=active]:bg-white data-[state=active]:text-black md:flex-none"
                >
                  {entry.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="px-4 py-5 md:px-6">
          {isLoading ? (
            <HistoryGridFallback />
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg">No watch history yet</p>
              <p className="mt-2 text-sm">
                Start something and it will show up here.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild variant="chrome" size="lg">
                  <Link href="/movies">Browse Movies</Link>
                </Button>
                <Button asChild variant="chrome" size="lg">
                  <Link href="/tvshows">Browse TV Shows</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
              {items.map((item, index) => (
                <RecentlyWatchedCard
                  key={`${item.mediaType}-${item.contentId}-${item.updatedAt}`}
                  item={item}
                  priority={index <= 3}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
