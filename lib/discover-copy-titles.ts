const DISCOVER_SLUG_TITLES: Record<string, string> = {
  "studio-a24": "A24",
  "studio-disney": "Disney",
  "studio-pixar": "Pixar",
  "studio-warner-bros": "Warner Bros.",
  "studio-universal": "Universal",
  "studio-dreamworks": "DreamWorks",
  "studio-marvel-studios": "Marvel Studios",
  "filter-action": "Action",
  "filter-comedy": "Comedy",
  "filter-drama": "Drama",
  "filter-thriller": "Thriller",
  "filter-horror": "Horror",
  "filter-scifi": "Sci‑Fi & Fantasy",
  "filter-romance": "Romance",
  "filter-documentary": "Documentary",
  "filter-animation": "Animation",
};

export const getDiscoverSlugTitle = (slug: string): string | undefined =>
  DISCOVER_SLUG_TITLES[slug];

export const getYearDiscoverTitle = (
  year: string,
  mediaType: "movie" | "tv",
): string => {
  const contentType = mediaType === "tv" ? "TV Shows" : "Movies";
  if (year.includes("-")) {
    const [startYear] = year.split("-");
    return `${startYear}s ${contentType}`;
  }
  return `${year} ${contentType}`;
};
