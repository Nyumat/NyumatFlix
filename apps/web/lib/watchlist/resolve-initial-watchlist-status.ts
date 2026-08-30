import {
  getLatestTvPlaybackCoords,
  getPlaybackProgress,
  resolveResumeTime,
} from "@/lib/playback/progress-storage";
import type { WatchlistStatus } from "@/lib/domain/watchlist";

export type ResolvedInitialWatchlistStatus = {
  status: WatchlistStatus;
  label: string;
  seasonNumber?: number;
  episodeNumber?: number;
};

/**
 * Determines the smart initial watchlist status and label when a user adds a title to their watchlist.
 *
 * Rules:
 * - Movies:
 *   - Completed: if movie was watched to within buffer (resolveResumeTime == 0 but watched > 0).
 *   - Watching: if movie has active resume progress (resolveResumeTime > 0).
 *   - Plan to Watch: untouched movie.
 * - TV Shows:
 *   - If any episode has progress, finds the most recently updated episode progress:
 *     - If progress is active (resume time > 0 or watched > 0): "watching" (e.g. S1:E3).
 *   - If no episode has progress: "plan_to_watch" ("Plan to Watch").
 */
export function resolveInitialWatchlistStatus(params: {
  contentId: number;
  mediaType: "movie" | "tv";
}): ResolvedInitialWatchlistStatus {
  const { contentId, mediaType } = params;

  if (mediaType === "movie") {
    const movieProgress = getPlaybackProgress({
      mediaType: "movie",
      contentId,
    });

    if (movieProgress && movieProgress.watched > 0) {
      const resumeTime = resolveResumeTime(movieProgress);
      if (resumeTime > 0) {
        return {
          status: "watching",
          label: "Saved to Watching",
        };
      }
      // Movie was watched to completion
      return {
        status: "completed",
        label: "Saved to Completed",
      };
    }

    return {
      status: "plan_to_watch",
      label: "Saved to Plan to Watch",
    };
  }

  const latest = getLatestTvPlaybackCoords(contentId);

  if (latest) {
    const progress = getPlaybackProgress({
      mediaType: "tv",
      contentId,
      seasonNumber: latest.seasonNumber,
      episodeNumber: latest.episodeNumber,
    });

    if (progress && progress.watched > 0) {
      return {
        status: "watching",
        label: `Saved to Watching (S${latest.seasonNumber}:E${latest.episodeNumber})`,
        seasonNumber: latest.seasonNumber,
        episodeNumber: latest.episodeNumber,
      };
    }
  }

  return {
    status: "plan_to_watch",
    label: "Saved to Plan to Watch",
  };
}
