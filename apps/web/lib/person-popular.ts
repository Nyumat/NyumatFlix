import { tmdb } from "@/tmdb/api";
import type { Person } from "@/tmdb/models";
import { getTodayIsoDateUtc } from "@/lib/released-media";
import { unstable_cache } from "next/cache";

const PER_PAGE = 20;
const SCAN_POPULAR_PAGES = 12;
const DIRECTOR_MOVIE_PAGES = 6;

export const PEOPLE_DEPARTMENT_VALUES = [
  "Acting",
  "Directing",
  "Production",
] as const;

export type PeopleDepartmentValue = (typeof PEOPLE_DEPARTMENT_VALUES)[number];

export const isPeopleDepartmentValue = (
  value: string | undefined,
): value is PeopleDepartmentValue =>
  value !== undefined &&
  (PEOPLE_DEPARTMENT_VALUES as readonly string[]).includes(value);

export type PeopleGenderFilter = 1 | 2;

export const isPeopleGenderFilter = (
  value: string | undefined,
): value is "1" | "2" => value === "1" || value === "2";

const getCachedPopularDirectors = unstable_cache(
  async (): Promise<Person[]> => {
    const today = getTodayIsoDateUtc();
    const movieBatches = await Promise.all(
      Array.from({ length: DIRECTOR_MOVIE_PAGES }, (_, i) =>
        tmdb.discover.movie({
          page: String(i + 1),
          sort_by: "popularity.desc",
          "primary_release_date.lte": today,
        }),
      ),
    );

    const movies = movieBatches.flatMap((batch) => batch.results ?? []);

    const creditsBatches = await Promise.all(
      movies.map((movie) => tmdb.movie.credits({ id: movie.id })),
    );

    const directors: Person[] = [];
    const seen = new Set<number>();

    for (const credits of creditsBatches) {
      for (const crew of credits.crew ?? []) {
        if (crew.job !== "Director") continue;
        if (!crew.profile_path) continue;
        if (seen.has(crew.id)) continue;
        seen.add(crew.id);
        directors.push({
          id: crew.id,
          name: crew.name,
          known_for: [],
          profile_path: crew.profile_path,
          adult: crew.adult,
          known_for_department: crew.known_for_department ?? "Directing",
          gender: crew.gender ?? 0,
          popularity: crew.popularity ?? 0,
        });
      }
    }

    return directors;
  },
  ["popular-directors-v1"],
  { revalidate: 3600 },
);

export async function fetchPopularPeopleByDepartment(
  department: PeopleDepartmentValue,
  page: string,
  options?: { gender?: PeopleGenderFilter },
): Promise<{
  results: Person[];
  total_pages: number;
  page: number;
}> {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);

  const matched: Person[] = [];
  const seen = new Set<number>();

  if (department === "Directing") {
    matched.push(...(await getCachedPopularDirectors()));
  } else {
    const batches = await Promise.all(
      Array.from({ length: SCAN_POPULAR_PAGES }, (_, i) =>
        tmdb.person.list({
          list: "popular",
          page: String(i + 1),
        }),
      ),
    );

    const gender = options?.gender;

    for (const batch of batches) {
      for (const p of batch.results ?? []) {
        if (p.known_for_department !== department) continue;
        if (
          gender !== undefined &&
          department === "Acting" &&
          p.gender !== gender
        ) {
          continue;
        }
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        matched.push(p);
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(matched.length / PER_PAGE));
  const offset = (pageNum - 1) * PER_PAGE;
  const results = matched.slice(offset, offset + PER_PAGE);

  return {
    results,
    total_pages: totalPages,
    page: pageNum,
  };
}
