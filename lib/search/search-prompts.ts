import {
  filterReleasedMovies,
  filterReleasedTvShows,
} from "@/lib/released-media";
import { tmdb } from "@/tmdb/api";

export interface SearchPrompt {
  id: string;
  query: string;
  label: string;
}

export interface SearchPromptsResponse {
  prompts: SearchPrompt[];
}

const MAX_PROMPTS = 6;

const normalizePromptKey = (value: string): string =>
  value.trim().toLowerCase();

const addPrompt = (
  prompts: SearchPrompt[],
  seen: Set<string>,
  prompt: Omit<SearchPrompt, "id">,
): void => {
  const query = prompt.query.trim();
  if (!query) {
    return;
  }

  const key = normalizePromptKey(query);
  if (seen.has(key) || prompts.length >= MAX_PROMPTS) {
    return;
  }

  seen.add(key);
  prompts.push({
    ...prompt,
    query,
    id: key,
  });
};

export async function buildSearchPrompts(): Promise<SearchPromptsResponse> {
  const [trendingMoviesRes, trendingTvRes, trendingPeopleRes] =
    await Promise.all([
      tmdb.trending.movie({ time: "day", page: "1" }),
      tmdb.trending.tv({ time: "day", page: "1" }),
      tmdb.trending.people({ time: "day", page: "1" }),
    ]);

  const trendingMovies = filterReleasedMovies(trendingMoviesRes.results ?? []);
  const trendingTv = filterReleasedTvShows(trendingTvRes.results ?? []);
  const trendingPeople = (trendingPeopleRes.results ?? []).filter((person) =>
    person.name?.trim(),
  );

  const seen = new Set<string>();
  const prompts: SearchPrompt[] = [];

  for (const movie of trendingMovies.slice(0, 3)) {
    addPrompt(prompts, seen, {
      query: movie.title ?? "",
      label: movie.title ?? "Unknown",
    });
  }

  for (const show of trendingTv.slice(0, 2)) {
    addPrompt(prompts, seen, {
      query: show.name ?? "",
      label: show.name ?? "Unknown",
    });
  }

  for (const person of trendingPeople.slice(0, 1)) {
    addPrompt(prompts, seen, {
      query: person.name,
      label: person.name,
    });
  }

  return { prompts };
}
