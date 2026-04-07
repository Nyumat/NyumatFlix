const isNonEmptyPath = (p: string | null | undefined): boolean =>
  typeof p === "string" && p.trim() !== "";

export const hasPosterPath = (item: { poster_path?: string | null }): boolean =>
  isNonEmptyPath(item.poster_path);

export const hasProfilePath = (item: {
  profile_path?: string | null;
}): boolean => isNonEmptyPath(item.profile_path);

export const filterWithPosterPath = <T extends { poster_path?: string | null }>(
  items: readonly T[],
): T[] => items.filter(hasPosterPath);
