import { isAnimeSearchCard } from "@/lib/cards/selectors";
import { mapMediaListToCanonicalCardsValue } from "@/lib/cards/mappers";
import type { CanonicalMediaCard } from "@/lib/domain/typings";
import type { MediaItem } from "@/lib/domain/typings";

const readSourceAnilistId = (
  item: MediaItem | CanonicalMediaCard,
): number | null => {
  if (
    "sourceAnilistId" in item &&
    typeof item.sourceAnilistId === "number" &&
    Number.isInteger(item.sourceAnilistId)
  ) {
    return item.sourceAnilistId;
  }
  return null;
};

const isAnilistOnlyHref = (href: string): boolean =>
  /\/(?:tvshows\/anilist-\d+|anime\/\d+)/i.test(href);

const normalizeSearchTitle = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getSearchCardTitle = (card: CanonicalMediaCard): string =>
  card.title || card.name || "";

export const rankSearchMediaResults = (
  results: CanonicalMediaCard[],
  query: string,
): CanonicalMediaCard[] => {
  const normalizedQuery = normalizeSearchTitle(query.trim());
  if (!normalizedQuery || results.length <= 1) {
    return results;
  }

  const scored = results.map((card, index) => {
    const title = normalizeSearchTitle(getSearchCardTitle(card));
    let score = card.popularity ?? 0;

    if (title === normalizedQuery) {
      score += 500;
    } else if (title.startsWith(normalizedQuery)) {
      score += 200;
    } else if (title.includes(normalizedQuery)) {
      score += 80;
    }

    score += (card.vote_average ?? 0) * 12;
    score += Math.min(card.vote_count ?? 0, 5000) / 250;

    if (isAnimeSearchCard(card)) {
      score -= 120;
    }

    return { card, index, score };
  });

  return scored
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.card);
};

const dedupeAnilistAgainstTmdb = (
  tmdbCards: CanonicalMediaCard[],
  anilistCards: CanonicalMediaCard[],
): CanonicalMediaCard[] => {
  const tmdbIds = new Set(tmdbCards.map((card) => card.id));
  const seenAnilistIds = new Set<number>();

  return anilistCards.filter((card) => {
    const sourceAnilistId = readSourceAnilistId(card);
    if (sourceAnilistId !== null) {
      if (seenAnilistIds.has(sourceAnilistId)) {
        return false;
      }
      seenAnilistIds.add(sourceAnilistId);
    }

    if (tmdbIds.has(card.id) && !isAnilistOnlyHref(card.href)) {
      return false;
    }

    return true;
  });
};

export const mergeSearchMediaResults = (
  tmdbCards: CanonicalMediaCard[],
  anilistItems: MediaItem[],
  options: { limit?: number; query?: string } = {},
): CanonicalMediaCard[] => {
  const anilistCards = mapMediaListToCanonicalCardsValue(anilistItems);
  const supplemental = dedupeAnilistAgainstTmdb(tmdbCards, anilistCards);

  let merged = [...tmdbCards, ...supplemental];

  if (options.query?.trim()) {
    merged = rankSearchMediaResults(merged, options.query);
  }

  if (typeof options.limit === "number" && options.limit > 0) {
    return merged.slice(0, options.limit);
  }

  return merged;
};
