import {
  buildKitsuAnimePath,
  fetchKitsuAnimePage,
  kitsuSortForAnilistSort,
  kitsuStatusForAnilistStatus,
  kitsuSubtypeForAnilistFormat,
  readKitsuAnimePage,
} from "@/lib/kitsu/client";
import {
  isKitsuFallbackId,
  kitsuFallbackIdToKitsuId,
  kitsuPageToAniListPage,
  kitsuResourceToAniListMedia,
} from "@/lib/anime-kitsu-fallback";
import { afterEach, describe, expect, it, vi } from "vitest";

const kitsuItem = (id: string) => ({
  id,
  type: "anime" as const,
  attributes: {
    canonicalTitle: "Sousou no Frieren",
    titles: {
      en: "Frieren: Beyond Journey's End",
      en_jp: "Sousou no Frieren",
      ja_jp: "葬送のフリーレン",
    },
    synopsis: "An elf mage outlives her party.",
    startDate: "2023-09-29",
    subtype: "TV",
    status: "finished",
    episodeCount: 28,
    averageRating: "82.5",
    userCount: 1000,
    favoritesCount: 100,
    popularityRank: 5,
    nsfw: false,
    posterImage: { large: "https://media.kitsu.app/poster.jpg" },
    coverImage: { large: "https://media.kitsu.app/cover.jpg" },
  },
});

const kitsuPageJson = (items: ReturnType<typeof kitsuItem>[]) => ({
  data: items,
  included: [
    {
      type: "mappings",
      attributes: { externalSite: "anilist/anime", externalId: "154587" },
      relationships: { item: { data: { type: "anime", id: items[0]?.id } } },
    },
    {
      type: "mappings",
      attributes: { externalSite: "myanimelist/anime", externalId: "52991" },
      relationships: { item: { data: { type: "anime", id: items[0]?.id } } },
    },
  ],
  meta: { count: 1 },
});

describe("kitsu client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps AniList sorts/statuses/formats to verified Kitsu values", () => {
    expect(kitsuSortForAnilistSort("SCORE_DESC")).toBe("-averageRating");
    expect(kitsuSortForAnilistSort("TRENDING_DESC")).toBe("-userCount");
    expect(kitsuSortForAnilistSort("NOPE")).toBe("-userCount");
    expect(kitsuStatusForAnilistStatus("RELEASING")).toBe("current");
    expect(kitsuStatusForAnilistStatus("NOT_YET_RELEASED")).toBe(
      "upcoming,tba",
    );
    expect(kitsuStatusForAnilistStatus("UNKNOWN")).toBeNull();
    expect(kitsuSubtypeForAnilistFormat("MOVIE")).toBe("movie");
    expect(kitsuSubtypeForAnilistFormat("SPECIAL")).toBe("special");
  });

  it("builds paged, year-scoped Kitsu paths within the 20-item cap", () => {
    const path = buildKitsuAnimePath({
      page: 2,
      perPage: 30,
      search: "frieren",
      sort: "-userCount",
      season: "winter",
      seasonYear: 2024,
    });
    expect(path).toContain("page%5Blimit%5D=20");
    expect(path).toContain("page%5Boffset%5D=20");
    expect(path).toContain("filter%5Btext%5D=frieren");
    expect(path).toContain("filter%5BseasonYear%5D=2024");
    expect(path).toContain("include=mappings");
  });

  it("omits season filter when no year is given", () => {
    const path = buildKitsuAnimePath({ season: "winter" });
    expect(path).not.toContain("filter%5Bseason%5D");
  });

  it("parses anilist + mal mappings from included", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(kitsuPageJson([kitsuItem("46474")]))),
      ),
    );
    const result = await fetchKitsuAnimePage({ page: 1, perPage: 20 });
    expect(result?.anilistIdsByKitsuId.get(46474)).toBe(154587);
    expect(result?.malIdsByKitsuId.get(46474)).toBe(52991);
    expect(result?.hasNextPage).toBe(false);
  });

  it("returns null when Kitsu is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    expect(await fetchKitsuAnimePage({ page: 1 })).toBeNull();
    expect(
      await readKitsuAnimePage("/anime?page%5Blimit%5D=1", { page: 1 }),
    ).toBeNull();
  });

  it("returns null when Kitsu returns malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 200 })),
    );
    await expect(fetchKitsuAnimePage({ page: 1 })).resolves.toBeNull();
  });
});

describe("kitsu fallback ids", () => {
  it("round-trips sentinel ids outside the AniList/TMDB ranges", () => {
    // Real AniList/TMDB ids are positive; legacy TMDB sentinels are > -1M.
    expect(isKitsuFallbackId(-2_000_046_474)).toBe(true);
    expect(kitsuFallbackIdToKitsuId(-2_000_046_474)).toBe(46474);
    expect(isKitsuFallbackId(154587)).toBe(false);
    expect(isKitsuFallbackId(-1429)).toBe(false);
    expect(isKitsuFallbackId(-1_001_429)).toBe(false);
  });
});

describe("kitsuResourceToAniListMedia", () => {
  it("rehydrates canonical AniList ids from mappings", () => {
    const media = kitsuResourceToAniListMedia(
      kitsuItem("46474"),
      [],
      154587,
      52991,
    );
    expect(media?.id).toBe(154587);
    expect(media?.idMal).toBe(52991);
    expect(media?.title.english).toBe("Frieren: Beyond Journey's End");
    expect(media?.format).toBe("TV");
    expect(media?.status).toBe("FINISHED");
    expect(media?.episodes).toBe(28);
    expect(media?.seasonYear).toBe(2023);
    expect(media?.coverImage?.large).toBe("https://media.kitsu.app/poster.jpg");
    expect(media?.bannerImage).toBe("https://media.kitsu.app/cover.jpg");
  });

  it("uses sentinel ids when no mapping exists", () => {
    const media = kitsuResourceToAniListMedia(kitsuItem("46474"));
    expect(media?.id).toBeLessThan(-2_000_000_000);
    expect(isKitsuFallbackId(media?.id ?? 0)).toBe(true);
  });

  it("converts pages with canonical ids preserved", () => {
    const page = kitsuPageToAniListPage(
      {
        items: [kitsuItem("46474")],
        anilistIdsByKitsuId: new Map([[46474, 154587]]),
        malIdsByKitsuId: new Map([[46474, 52991]]),
        page: 1,
        perPage: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
      },
      20,
    );
    expect(page.media[0]?.id).toBe(154587);
    expect(page.pageInfo.total).toBe(1);
  });
});
