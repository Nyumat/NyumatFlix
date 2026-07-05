"use client";

import { useQuery } from "@tanstack/react-query";

import {
  extractVideoRowsFromMediaVideos,
  selectPrimaryTrailerVideo,
  type TrailerPickRow,
} from "@/lib/select-primary-trailer-video";
import { queryKeys } from "@/lib/query-keys";

function sortTrailerVideos(rows: TrailerPickRow[]): TrailerPickRow[] {
  const primary = selectPrimaryTrailerVideo(rows);
  if (!primary) {
    return rows;
  }

  return [
    primary,
    ...rows.filter((video) => video.key !== primary.key),
  ] as TrailerPickRow[];
}

export function useMediaVideosQuery(
  mediaType: "tv" | "movie",
  mediaId: number,
  initialVideos: TrailerPickRow[],
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.mediaVideos(mediaType, mediaId),
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/media/${mediaType}/${mediaId}/videos`,
        {
          signal,
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch videos: ${response.status}`);
      }

      const data: unknown = await response.json();
      const rows = extractVideoRowsFromMediaVideos(data).filter(
        (video) =>
          (!video.site || video.site === "YouTube") && Boolean(video.key),
      );
      return sortTrailerVideos(rows);
    },
    enabled,
    initialData: initialVideos,
    staleTime: 30 * 60 * 1000,
  });
}
