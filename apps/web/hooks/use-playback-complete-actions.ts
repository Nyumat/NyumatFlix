"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  watchlistStatusAfterComplete,
  type ContinueWatchingCompleteMedia,
} from "@/lib/playback/continue-watching-complete";
import { applyContinueWatchingComplete } from "@/lib/watchlist/apply-continue-watching-complete";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { mapWatchlistStatusToMalStatus } from "@/lib/mal/status-maps";

type UsePlaybackCompleteActionsOptions = {
  contentId: number;
  mediaType: "movie" | "tv";
  anilistId?: number | null;
  completeMedia?: ContinueWatchingCompleteMedia | null;
  onWatchlistUpdated?: () => void;
};

export function usePlaybackCompleteActions({
  contentId,
  mediaType,
  anilistId,
  completeMedia,
  onWatchlistUpdated,
}: UsePlaybackCompleteActionsOptions) {
  const session = useSession();

  const applyPlaybackComplete = useCallback(async () => {
    const { seasonNumber, selectedEpisode } = useEpisodeStore.getState();
    const episodeNumber = selectedEpisode?.episode_number;

    const resolvedCompleteMedia =
      completeMedia ??
      (mediaType === "movie" ? { mediaType: "movie" as const } : null);

    if (!resolvedCompleteMedia) {
      return;
    }

    const status = watchlistStatusAfterComplete({
      ...resolvedCompleteMedia,
      mediaType,
      seasonNumber: seasonNumber ?? undefined,
      episodeNumber: episodeNumber ?? undefined,
    });

    if (status === null) {
      return;
    }

    const isSignedIn = Boolean(session.data?.user?.id);

    try {
      if (isSignedIn) {
        await applyContinueWatchingComplete({
          contentId,
          mediaType,
          status,
          seasonNumber: seasonNumber ?? undefined,
          episodeNumber: episodeNumber ?? undefined,
        });

        let malUpdated = false;
        if (mediaType === "tv" && typeof anilistId === "number") {
          const malStatus = mapWatchlistStatusToMalStatus(status);
          const patch: Record<string, unknown> = {
            anilistId,
            tmdbId: contentId,
            mediaType,
            seasonNumber: seasonNumber ?? undefined,
            status: malStatus,
          };
          if (
            malStatus === "completed" &&
            typeof episodeNumber === "number" &&
            episodeNumber > 0
          ) {
            patch.numEpisodesWatched = episodeNumber;
          }

          const malResponse = await fetch("/api/mal/entry", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          malUpdated = malResponse.ok;
        }

        onWatchlistUpdated?.();

        if (status === "completed") {
          toast.success(
            malUpdated
              ? "Marked complete on your watchlist and MyAnimeList"
              : "Marked complete on your watchlist",
          );
        }
      } else {
        toast("Marked as complete on this device", {
          description: "Sign in to sync with your watchlist and MAL.",
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Couldn't update watchlist");
    }
  }, [
    anilistId,
    completeMedia,
    contentId,
    mediaType,
    onWatchlistUpdated,
    session.data?.user?.id,
  ]);

  return { applyPlaybackComplete };
}
