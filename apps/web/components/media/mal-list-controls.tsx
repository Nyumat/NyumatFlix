"use client";

import Image from "next/image";
import { Loader2, Star } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineNumberEditor } from "@/components/ui/inline-number-editor";
import { queryStaleTime } from "@/lib/cache-policy";
import {
  MAL_LIST_STATUS_OPTIONS,
  MAL_SCORE_OPTIONS,
  malListStatusLabel,
  malScoreLabel,
  type MalListStatus,
} from "@/lib/mal/constants";
import {
  applyMalEntryPatch,
  applyMalListIndexPatch,
  findMalListIndexItem,
  malEntryFromIndexItem,
  shouldApplyMalPatchResponse,
  type MalEntryOptimisticPatch,
  type MalListIndex,
  type MalListIndexItem,
} from "@/lib/mal/list-index-shared";
import type { MalEntryResponse } from "@/lib/mal/types";
import { useMalListIndex } from "@/hooks/use-mal-list-index";
import { useMalSyncStatus } from "@/hooks/use-mal-sync-status";
import { cn } from "@/lib/utils";

const controlTriggerClass =
  "h-9 min-w-0 rounded-md border border-white/30 bg-black/40 text-white shadow-md backdrop-blur-md hover:bg-black/50 focus:ring-white/30 data-[placeholder]:text-white/70";

type MalListControlsProps = {
  anilistId?: number | null;
  contentId: number;
  mediaType: "movie" | "tv";
  seasonNumber?: number | null;
  showEnded?: boolean;
  className?: string;
  compact?: boolean;
  indexItem?: MalListIndexItem;
  onUpdated?: () => void;
};

async function fetchMalEntry(
  params: URLSearchParams,
): Promise<MalEntryResponse> {
  const response = await fetch(`/api/mal/entry?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load MAL entry");
  }
  const data = (await response.json()) as { entry: MalEntryResponse };
  return data.entry;
}

export function MalListControls({
  anilistId,
  contentId,
  mediaType,
  seasonNumber,
  showEnded = false,
  className,
  compact = false,
  indexItem: indexItemProp,
  onUpdated,
}: MalListControlsProps) {
  const queryClient = useQueryClient();
  const patchGenerationRef = useRef(0);
  const malListIndexKey = ["mal-list-index"] as const;
  const malStatusQuery = useMalSyncStatus();
  const malConnected = malStatusQuery.data?.connected === true;
  const { items: malIndexItems } = useMalListIndex();

  const indexItem = useMemo(() => {
    if (indexItemProp) {
      return indexItemProp;
    }
    return findMalListIndexItem(malIndexItems, mediaType, contentId);
  }, [contentId, indexItemProp, malIndexItems, mediaType]);

  const placeholderEntry = useMemo(
    () => (indexItem ? malEntryFromIndexItem(indexItem) : undefined),
    [indexItem],
  );

  const queryKey = useMemo(
    () => [
      "mal-entry",
      anilistId ?? null,
      contentId,
      mediaType,
      seasonNumber ?? null,
    ],
    [anilistId, contentId, mediaType, seasonNumber],
  );

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    if (anilistId) {
      params.set("anilistId", String(anilistId));
    }
    params.set("tmdbId", String(contentId));
    params.set("mediaType", mediaType);
    if (seasonNumber) {
      params.set("seasonNumber", String(seasonNumber));
    }
    return params;
  }, [anilistId, contentId, mediaType, seasonNumber]);

  const entryQuery = useQuery({
    queryKey,
    queryFn: () => fetchMalEntry(searchParams),
    staleTime: queryStaleTime(30_000),
    retry: false,
    enabled: malConnected,
    placeholderData: placeholderEntry,
  });

  const entry = entryQuery.data;
  const watched = entry?.listStatus?.num_episodes_watched ?? 0;
  const total = entry?.numEpisodes ?? null;
  const currentStatus = (entry?.listStatus?.status ??
    (entry?.onList ? "watching" : "plan_to_watch")) as MalListStatus;
  const currentScore = entry?.listStatus?.score ?? 0;

  const patchEntry = useCallback(
    async (patch: MalEntryOptimisticPatch) => {
      const patchGeneration = ++patchGenerationRef.current;
      const previousEntry =
        queryClient.getQueryData<MalEntryResponse>(queryKey);
      if (!previousEntry) {
        return;
      }

      const optimisticEntry = applyMalEntryPatch(previousEntry, patch);
      queryClient.setQueryData(queryKey, optimisticEntry);

      const previousIndex =
        queryClient.getQueryData<MalListIndex>(malListIndexKey);
      if (previousIndex) {
        queryClient.setQueryData(
          malListIndexKey,
          applyMalListIndexPatch(previousIndex, mediaType, contentId, patch),
        );
      }

      try {
        const response = await fetch("/api/mal/entry", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anilistId: anilistId ?? undefined,
            tmdbId: contentId,
            mediaType,
            seasonNumber: seasonNumber ?? undefined,
            ...patch,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update MAL list");
        }

        const data = (await response.json()) as { entry: MalEntryResponse };
        if (
          !shouldApplyMalPatchResponse(
            patchGeneration,
            patchGenerationRef.current,
          )
        ) {
          return;
        }

        queryClient.setQueryData(queryKey, data.entry);
        void queryClient.invalidateQueries({ queryKey: malListIndexKey });
        onUpdated?.();
      } catch (error) {
        if (
          !shouldApplyMalPatchResponse(
            patchGeneration,
            patchGenerationRef.current,
          )
        ) {
          return;
        }

        queryClient.setQueryData(queryKey, previousEntry);
        if (previousIndex) {
          queryClient.setQueryData(malListIndexKey, previousIndex);
        }
        console.error(error);
        toast.error("Couldn't update MyAnimeList");
      }
    },
    [
      anilistId,
      contentId,
      malListIndexKey,
      mediaType,
      onUpdated,
      queryClient,
      queryKey,
      seasonNumber,
    ],
  );

  const handleStatusChange = (value: string) => {
    void patchEntry({ status: value as MalListStatus });
  };

  const handleScoreChange = (value: string) => {
    const score = Number.parseInt(value, 10);
    void patchEntry({ score });
  };

  const handleEpisodeCountCommit = (next: number) => {
    if (next === watched) {
      return;
    }

    const shouldComplete =
      showEnded && total !== null && total > 0 && next >= total;

    void patchEntry({
      numEpisodesWatched: next,
      ...(shouldComplete ? { status: "completed" } : {}),
    });
  };

  const episodeMax =
    total !== null && total > 0 ? total : Number.MAX_SAFE_INTEGER;
  const incrementDisabled =
    total !== null && total > 0 && watched >= total && showEnded;

  if (!malConnected) {
    return null;
  }

  if (entryQuery.isLoading && !entry) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 opacity-80",
          className,
        )}
        data-testid="mal-list-controls-loading"
      >
        <Select disabled>
          <SelectTrigger className={cn(controlTriggerClass, "w-[9.5rem]")}>
            <SelectValue>Syncing…</SelectValue>
          </SelectTrigger>
        </Select>
        <Loader2 className="size-4 animate-spin text-white/50" />
      </div>
    );
  }

  if (entryQuery.isError && !entry) {
    return (
      <div
        className={cn(
          "rounded-md border border-white/20 bg-black/40 px-3 py-2 text-xs text-white/70",
          className,
        )}
        data-testid="mal-list-controls-unavailable"
      >
        No MyAnimeList match for this title.
      </div>
    );
  }

  if (!entry) {
    return null;
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      data-testid="mal-list-controls"
    >
      {!compact ? (
        <div className="flex items-center gap-1.5 pr-1">
          <Image
            src="/myanimelist-logo.png"
            alt=""
            width={16}
            height={16}
            className="size-4 rounded-sm opacity-90"
          />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
            MAL
          </span>
        </div>
      ) : null}

      <Select value={currentStatus} onValueChange={handleStatusChange}>
        <SelectTrigger
          className={cn(
            controlTriggerClass,
            compact ? "w-[8.5rem]" : "w-[9.5rem]",
          )}
        >
          <SelectValue>{malListStatusLabel(currentStatus)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MAL_LIST_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(currentScore)} onValueChange={handleScoreChange}>
        <SelectTrigger
          className={cn(
            controlTriggerClass,
            compact ? "w-[9.5rem]" : "w-[10.5rem]",
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Star className="size-3.5 shrink-0 text-yellow-400 fill-yellow-400" />
            <span className="truncate">{malScoreLabel(currentScore)}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          {MAL_SCORE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div
        className={cn(
          controlTriggerClass,
          "flex h-9 items-center px-3 text-sm",
        )}
      >
        <InlineNumberEditor
          prefix="Episodes:"
          value={watched}
          totalEpisodes={total}
          min={0}
          max={episodeMax}
          incrementDisabled={incrementDisabled}
          decrementDisabled={watched <= 0}
          showDecrement
          ariaLabel="Edit watched episodes"
          onCommit={handleEpisodeCountCommit}
        />
      </div>
    </div>
  );
}
