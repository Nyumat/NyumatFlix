export const animeShowcaseRowId = (genre: string) =>
  `showcase-anime-${genre
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
