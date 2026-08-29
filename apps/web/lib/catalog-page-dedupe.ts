export const makeEntityKey = (id: number, type: "movie" | "tv"): string =>
  `${type}:${id}`;

export const filterUnseenByEntityKey = <T extends { id: number }>(
  items: T[],
  seen: Set<string>,
  type: "movie" | "tv",
): T[] =>
  items.filter((item) => {
    const key = makeEntityKey(item.id, type);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

/** ordered take: skip ids already in `seen`, add each taken id to `seen` */
export const takeUniqueByIdInOrder = <T extends { id: number }>(
  items: T[],
  seen: Set<number>,
  max: number,
): T[] => {
  const out: T[] = [];
  for (const item of items) {
    if (out.length >= max) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
};

export const filterUnseenById = <T extends { id: number }>(
  items: T[],
  seen: Set<number>,
): T[] => items.filter((item) => !seen.has(item.id));
