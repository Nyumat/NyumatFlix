type SearchMultiItem = {
  media_type?: string;
  title?: string;
  name?: string;
  popularity?: number;
};

const MAX_SUGGESTIONS = 6;

export function buildSearchSuggestions(
  items: SearchMultiItem[] | undefined,
): string[] {
  if (!items?.length) {
    return [];
  }

  const sorted = [...items].sort(
    (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
  );

  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const item of sorted) {
    const label =
      item.media_type === "movie"
        ? item.title
        : item.media_type === "tv" || item.media_type === "person"
          ? item.name
          : item.title || item.name;

    if (!label?.trim()) {
      continue;
    }

    const normalized = label.trim().toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    suggestions.push(label.trim());

    if (suggestions.length >= MAX_SUGGESTIONS) {
      break;
    }
  }

  return suggestions;
}
