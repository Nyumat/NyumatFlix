import "server-only";

import { slimMediaItemsForRsc } from "@/lib/cards/catalog-dto";
import { animeShowcaseRowId } from "@/lib/anime-showcase";
import type { MediaItem } from "@/lib/domain/typings";
import {
  ANIME_HUB_GENRES,
  enrichAnimeHubAdultRow,
  enrichAnimeHubStandardRow,
  fetchAnimeHubAllGenreRows,
  getAnimeHubLinks,
  type AnimeHubGenreFormat,
} from "@/lib/server/anime-hub-data";
import {
  ANIME_HUB_ROW_GENRE,
  pickHubCarouselItems,
} from "@/lib/server/anime-hub-layout";

type AnimeShowcaseItem = MediaItem & {
  sourceAnilistId?: number;
  href?: string;
  isAniListFallback?: boolean;
};

const slimAnimeShowcaseItems = (items: MediaItem[]): MediaItem[] => {
  const slimmed = slimMediaItemsForRsc(items);
  return slimmed.map((item, index) => {
    const original = items[index] as AnimeShowcaseItem | undefined;
    return {
      ...item,
      ...(typeof original?.sourceAnilistId === "number"
        ? { sourceAnilistId: original.sourceAnilistId }
        : {}),
      ...(typeof original?.href === "string" ? { href: original.href } : {}),
      ...(typeof original?.isAniListFallback === "boolean"
        ? { isAniListFallback: original.isAniListFallback }
        : {}),
    } as MediaItem;
  });
};

export const fetchAnimeShowcaseRows = async (
  format: AnimeHubGenreFormat,
): Promise<
  Array<{ rowId: string; title: string; href: string; items: MediaItem[] }>
> => {
  const genreRaws = await fetchAnimeHubAllGenreRows(format);
  const links = getAnimeHubLinks();
  const genreFormat = format === "movie" ? "MOVIE" : undefined;
  const enriched = await Promise.all(
    genreRaws.map((raw, index) => {
      const genre = ANIME_HUB_GENRES[index];
      if (genre === "Hentai") {
        return enrichAnimeHubAdultRow(raw);
      }
      return enrichAnimeHubStandardRow(raw);
    }),
  );

  const rows: Array<{
    rowId: string;
    title: string;
    href: string;
    items: MediaItem[];
  }> = [];

  for (const [index, genre] of ANIME_HUB_GENRES.entries()) {
    const items = pickHubCarouselItems(
      enriched[index] ?? [],
      ANIME_HUB_ROW_GENRE,
    );
    if (items.length === 0) {
      continue;
    }

    rows.push({
      rowId: animeShowcaseRowId(genre),
      title: genre,
      href: links.genre(genre, genreFormat),
      items: slimAnimeShowcaseItems(items),
    });
  }

  return rows;
};
