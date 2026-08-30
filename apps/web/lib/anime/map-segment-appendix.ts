import "server-only";

import { getCachedAnilistTvMedia } from "@/lib/anilist-tv-detail";
import type { MappingSegment } from "@/lib/anime/tmdb-anilist-map";
import {
  appendMappingSegmentsBeyond,
  buildFribbSeasonSegments,
} from "@/lib/anime/split-cour-appendix";
import { getFribbAnimeList } from "@/lib/fribb-mapping";

const extendTailWithSpecialSequelSegments = async (
  segments: MappingSegment[],
): Promise<MappingSegment[]> => {
  if (segments.length === 0) {
    return segments;
  }

  const extended = [...segments];
  let tail = extended[extended.length - 1]!;

  for (let depth = 0; depth < 3; depth += 1) {
    const media = await getCachedAnilistTvMedia(tail.anilistMediaId);
    const sequelNode = media?.relations?.edges?.find(
      (edge) =>
        edge.relationType === "SEQUEL" &&
        edge.node?.type === "ANIME" &&
        edge.node.format === "SPECIAL" &&
        typeof edge.node.id === "number" &&
        edge.node.id > 0,
    )?.node;

    if (!sequelNode?.id) {
      break;
    }

    if (extended.some((segment) => segment.anilistMediaId === sequelNode.id)) {
      break;
    }

    const startEpisode = tail.endEpisode + 1;
    const appendixSegment: MappingSegment = {
      startEpisode,
      endEpisode: startEpisode,
      anilistMediaId: sequelNode.id,
    };
    extended.push(appendixSegment);
    tail = appendixSegment;
  }

  return extended;
};

export const extendSeasonMapSegments = async (
  segments: MappingSegment[],
  tmdbShowId: number,
  seasonNumber: number,
): Promise<MappingSegment[]> => {
  const fribbRows = await getFribbAnimeList();
  const fribbSegments = buildFribbSeasonSegments(
    fribbRows,
    tmdbShowId,
    seasonNumber,
  );
  const merged = appendMappingSegmentsBeyond(segments, fribbSegments);
  return extendTailWithSpecialSequelSegments(merged);
};
