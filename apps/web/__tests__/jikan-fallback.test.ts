import {
  isJikanFallbackId,
  jikanFallbackIdToMalId,
  jikanItemToAniListMedia,
} from "@/lib/anime-jikan-fallback";
import {
  buildJikanAnimePath,
  buildJikanTopAnimePath,
  fetchJikanAnimePage,
  fetchJikanTopAnimePage,
  readJikanAnimePage,
  resetJikanGateForTests,
} from "@/lib/jikan/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jikanItem = () => ({
  mal_id: 52991,
  url: "https://myanimelist.net/anime/52991/Sousou_no_Frieren",
  title: "Sousou no Frieren",
  title_english: "Frieren: Beyond Journey's End",
  title_japanese: "葬送のフリーレン",
  type: "TV",
  status: "Finished Airing",
  synopsis: "An elf mage outlives her party.",
  year: 2023,
  episodes: 28,
  score: 9.29,
  popularity: 100,
  images: {
    jpg: {
      large_image_url: "https://cdn.myanimelist.net/images/anime/52991.jpg",
    },
  },
  aired: { from: "2023-09-29T00:00:00+00:00" },
  genres: [{ name: "Adventure" }, { name: "Drama" }, { name: "Fantasy" }],
  themes: [],
  explicit_genres: [],
});

describe("jikan client", () => {
  beforeEach(() => {
    resetJikanGateForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds sfw search + top paths within the 25-item cap", () => {
    const search = buildJikanAnimePath({
      page: 1,
      perPage: 30,
      search: "frieren",
    });
    expect(search).toContain("limit=25");
    expect(search).toContain("sfw=true");
    expect(search).toContain("q=frieren");

    const top = buildJikanTopAnimePath({ type: "tv", filter: "bypopularity" });
    expect(top).toContain("/top/anime");
    expect(top).toContain("filter=bypopularity");
  });

  it("parses paginated anime lists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [jikanItem()],
              pagination: {
                last_visible_page: 10,
                has_next_page: true,
                current_page: 1,
                items: { count: 25, total: 250, per_page: 25 },
              },
            }),
          ),
      ),
    );
    const result = await fetchJikanAnimePage({ page: 1, search: "frieren" });
    expect(result?.items).toHaveLength(1);
    expect(result?.hasNextPage).toBe(true);
    expect(result?.total).toBe(250);
  });

  it("returns null when Jikan/MAL is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 504 })),
    );
    expect(await fetchJikanAnimePage({ page: 1 })).toBeNull();
    expect(await fetchJikanTopAnimePage({ page: 1 })).toBeNull();
    expect(await readJikanAnimePage("/anime?page=1", { page: 1 })).toBeNull();
  });

  it("returns null when Jikan returns malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 200 })),
    );
    await expect(fetchJikanAnimePage({ page: 1 })).resolves.toBeNull();
  });
});

describe("jikan fallback ids", () => {
  it("round-trips MAL ids in a sentinel range below Kitsu's", () => {
    expect(isJikanFallbackId(-2_100_052_991)).toBe(true);
    expect(jikanFallbackIdToMalId(-2_100_052_991)).toBe(52991);
    expect(isJikanFallbackId(52991)).toBe(false);
    // Kitsu sentinel range must not collide.
    expect(isJikanFallbackId(-2_000_046_474)).toBe(false);
  });
});

describe("jikanItemToAniListMedia", () => {
  it("normalizes MAL payloads to AniListMedia with MAL sentinel ids", () => {
    const media = jikanItemToAniListMedia(jikanItem());
    expect(media?.idMal).toBe(52991);
    expect(isJikanFallbackId(media?.id ?? 0)).toBe(true);
    expect(media?.title.english).toBe("Frieren: Beyond Journey's End");
    expect(media?.format).toBe("TV");
    expect(media?.status).toBe("FINISHED");
    expect(media?.seasonYear).toBe(2023);
    expect(media?.genres).toEqual(["Adventure", "Drama", "Fantasy"]);
    expect(media?.averageScore).toBe(9.3);
  });
});
