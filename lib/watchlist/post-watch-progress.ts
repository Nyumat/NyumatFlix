import { getSession } from "next-auth/react";

export type PostWatchProgressInput = {
  contentId: number;
  mediaType: "movie" | "tv";
  seasonNumber?: number;
  episodeNumber?: number;
  anilistId?: number | null;
  episodeCompleted?: boolean;
};

export async function postWatchProgressIfSignedIn(
  input: PostWatchProgressInput,
): Promise<void> {
  const session = await getSession();
  if (!session?.user?.id) {
    return;
  }

  await fetch("/api/watchlist/progress", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contentId: input.contentId,
      mediaType: input.mediaType,
      ...(input.mediaType === "tv"
        ? {
            seasonNumber: input.seasonNumber,
            episodeNumber: input.episodeNumber,
          }
        : {}),
      ...(input.anilistId ? { anilistId: input.anilistId } : {}),
      ...(input.episodeCompleted ? { episodeCompleted: true } : {}),
    }),
  });
}
