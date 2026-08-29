import { beforeAll, describe, expect, it, vi } from "vitest";

const mockGetFribbRawList = vi.fn();

vi.mock("@/lib/fribb-mapping", () => ({
  getFribbRawList: () => mockGetFribbRawList(),
}));

vi.mock("@/lib/scrape/anime/anilist-meta", () => ({
  fetchMalIdByAnilist: vi.fn(),
}));

import { fetchMalIdByAnilist } from "@/lib/scrape/anime/anilist-meta";
import {
  resolveMalToAnilist,
  resolveMalToTmdb,
  resolveTmdbToMal,
} from "@/lib/mal/id-resolver";
import { resolveAnilistToMal } from "@/lib/mal/id-resolver-anilist";

const FRIBB_FIXTURE = [
  {
    anilist_id: 16498,
    mal_id: 16498,
    themoviedb_id: { tv: 1429 },
  },
];

beforeAll(() => {
  mockGetFribbRawList.mockResolvedValue(FRIBB_FIXTURE);
});

describe("MyAnimeList ID resolver", () => {
  it("resolves popular anime MAL ID to TMDB mapping", async () => {
    const mapping = await resolveMalToTmdb(16498);
    expect(mapping).not.toBeNull();
    expect(mapping?.tmdbId).toBe(1429);
    expect(mapping?.mediaType).toBe("tv");
  });

  it("resolves TMDB ID to MAL ID", async () => {
    const malId = await resolveTmdbToMal(1429, "tv");
    expect(malId).not.toBeNull();
    expect(malId).toBe(16498);
  });

  it("resolves MAL ID to AniList ID when available", async () => {
    const anilistId = await resolveMalToAnilist(16498);
    expect(anilistId).not.toBeNull();
    expect(anilistId).toBe(16498);
  });

  it("falls back to AniList idMal when Fribb has no AniList→MAL row", async () => {
    vi.mocked(fetchMalIdByAnilist).mockResolvedValueOnce(52717);
    const malId = await resolveAnilistToMal(153567);
    expect(malId).toBe(52717);
    expect(fetchMalIdByAnilist).toHaveBeenCalledWith(153567);
  });
});
