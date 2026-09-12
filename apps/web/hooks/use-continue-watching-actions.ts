"use client";

import { loginHref } from "@/lib/auth/callback-url";
import { applyContinueWatchingComplete } from "@/lib/watchlist/apply-continue-watching-complete";
import {
  continueWatchingTitleKey,
  dismissContinueWatchingTitle,
} from "@/lib/playback/continue-watching-dismiss";
import { watchlistStatusAfterComplete } from "@/lib/playback/continue-watching-complete";
import type { RecentlyWatchedItem } from "@/lib/playback/recently-watched";
import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export function useContinueWatchingActions() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isSignedIn = Boolean(session?.user?.id);
  const [pendingCompleteKey, setPendingCompleteKey] = useState<string | null>(
    null,
  );
  const [dismissRevision, setDismissRevision] = useState(0);

  const markComplete = useCallback(
    async (item: RecentlyWatchedItem) => {
      setPendingCompleteKey(
        continueWatchingTitleKey(item.mediaType, item.contentId),
      );
      dismissContinueWatchingTitle(
        item.mediaType,
        item.contentId,
        Math.max(Date.now(), item.updatedAt),
      );
      setDismissRevision((revision) => revision + 1);

      const status = watchlistStatusAfterComplete({
        mediaType: item.mediaType,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        lastAiredSeason: item.lastAiredSeason,
        lastAiredEpisode: item.lastAiredEpisode,
        showStatus: item.showStatus,
        hasNextEpisode: item.hasNextEpisode,
      });

      try {
        if (isSignedIn) {
          await applyContinueWatchingComplete({
            contentId: item.contentId,
            mediaType: item.mediaType,
            status,
            seasonNumber: item.seasonNumber,
            episodeNumber: item.episodeNumber,
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.watchlist(),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.personalizedHome(),
          });
        } else {
          toast("Marked as complete on this device", {
            description: "Make an account to sync across devices.",
            action: {
              label: "Sign in",
              onClick: () => {
                window.location.assign(
                  loginHref(
                    `${window.location.pathname}${window.location.search}`,
                  ),
                );
              },
            },
          });
        }
      } catch {
        toast.error("Couldn't update watchlist");
      } finally {
        setPendingCompleteKey(null);
      }
    },
    [isSignedIn, queryClient],
  );

  return {
    markComplete,
    pendingCompleteKey,
    dismissRevision,
  };
}
