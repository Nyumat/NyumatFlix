export const createYearFilterParams = (
  year: string,
  mediaType: "movie" | "tv" = "movie",
): {
  endpoint: string;
  params: Record<string, string>;
} => {
  const dateField =
    mediaType === "tv" ? "first_air_date" : "primary_release_date";

  if (year.includes("-")) {
    const [startYear, endYear] = year.split("-");
    return {
      endpoint: `/discover/${mediaType}`,
      params: {
        language: "en-US",
        include_adult: "false",
        sort_by: "popularity.desc",
        [`${dateField}.gte`]: `${startYear}-01-01`,
        [`${dateField}.lte`]: `${endYear}-12-31`,
        without_genres: "10749",
      },
    };
  }

  return {
    endpoint: `/discover/${mediaType}`,
    params: {
      language: "en-US",
      include_adult: "false",
      sort_by: "popularity.desc",
      [`${dateField}.gte`]: `${year}-01-01`,
      [`${dateField}.lte`]: `${year}-12-31`,
      without_genres: "10749",
    },
  };
};
