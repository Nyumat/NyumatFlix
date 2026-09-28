import { beforeEach, describe, expect, it, vi } from "vitest";

const movieDetail = vi.fn();
const tvDetail = vi.fn();

vi.mock("@/tmdb/api", () => ({
  tmdb: {
    movie: { detail: movieDetail },
    tv: { detail: tvDetail },
  },
}));

const { resolveImdbIdFromTmdb, resetTrailerImdbResolveCacheForTests } =
  await import("@/lib/trailer-imdb-resolve");

describe("resolveImdbIdFromTmdb", () => {
  beforeEach(() => {
    movieDetail.mockReset();
    tvDetail.mockReset();
    resetTrailerImdbResolveCacheForTests();
  });

  it("reads the root imdb_id for movies", async () => {
    movieDetail.mockResolvedValue({ imdb_id: "tt0137523" });

    await expect(resolveImdbIdFromTmdb(550, "movie")).resolves.toBe(
      "tt0137523",
    );
  });

  it("falls back to external_ids for movies", async () => {
    movieDetail.mockResolvedValue({
      imdb_id: null,
      external_ids: { imdb_id: "tt9999999" },
    });

    await expect(resolveImdbIdFromTmdb(550, "movie")).resolves.toBe(
      "tt9999999",
    );
  });

  it("reads external_ids for tv", async () => {
    tvDetail.mockResolvedValue({ external_ids: { imdb_id: "tt1234567" } });

    await expect(resolveImdbIdFromTmdb(1399, "tv")).resolves.toBe("tt1234567");
  });

  it("returns null when TMDB has no imdb id", async () => {
    tvDetail.mockResolvedValue({ external_ids: null });

    await expect(resolveImdbIdFromTmdb(1399, "tv")).resolves.toBeNull();
  });

  it("returns null on upstream failure", async () => {
    movieDetail.mockRejectedValue(new Error("boom"));

    await expect(resolveImdbIdFromTmdb(550, "movie")).resolves.toBeNull();
  });

  it("caches resolved ids", async () => {
    movieDetail.mockResolvedValue({ imdb_id: "tt0137523" });

    await resolveImdbIdFromTmdb(550, "movie");
    await resolveImdbIdFromTmdb(550, "movie");

    expect(movieDetail).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid tmdb ids without calling TMDB", async () => {
    await expect(resolveImdbIdFromTmdb(0, "movie")).resolves.toBeNull();
    await expect(resolveImdbIdFromTmdb(-5, "tv")).resolves.toBeNull();
    expect(movieDetail).not.toHaveBeenCalled();
    expect(tvDetail).not.toHaveBeenCalled();
  });
});
