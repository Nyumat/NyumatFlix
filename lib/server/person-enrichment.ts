import "server-only";

import { runInChunks } from "@/lib/server/chunked-parallel";
import { tmdb } from "@/tmdb/api";
import { cache } from "react";

const fetchPersonDeathday = cache(
  async (id: number): Promise<string | null> => {
    try {
      const detail = await tmdb.person.detail({ id: String(id) });
      return detail.deathday ?? null;
    } catch {
      return null;
    }
  },
);

export async function enrichPeopleWithDeathday<T extends { id: number }>(
  people: T[],
): Promise<Array<T & { deathday: string | null }>> {
  if (people.length === 0) {
    return [];
  }

  return runInChunks(people, async (person) => {
    const deathday = await fetchPersonDeathday(person.id);
    return { ...person, deathday };
  });
}
