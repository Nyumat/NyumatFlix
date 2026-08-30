import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchTvShowDetailClient,
  tvDetailTitleMatches,
} from "@/lib/tv-show-detail-client";

describe("tvDetailTitleMatches", () => {
  it("treats a missing expected title as a match", () => {
    expect(tvDetailTitleMatches("The Shop", undefined)).toBe(true);
  });

  it("matches SAO against a TMDB collision title as a miss", () => {
    expect(tvDetailTitleMatches("The Shop", "Sword Art Online")).toBe(false);
    expect(tvDetailTitleMatches("Sword Art Online", "Sword Art Online")).toBe(
      true,
    );
  });
});

describe("fetchTvShowDetailClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns the TMDB show when no expected title is provided", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/tv/11757") {
        return {
          ok: true,
          json: async () => ({ id: 11757, name: "The Shop" }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const result = await fetchTvShowDetailClient(11757);
    expect(result?.detail.name).toBe("The Shop");
    expect(result?.catalog).toBeNull();
  });

  it("returns the AniList show when the TMDB title does not match", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/tv/11757") {
        return {
          ok: true,
          json: async () => ({ id: 11757, name: "The Shop" }),
        };
      }
      if (url === "/api/anime/11757") {
        return {
          ok: true,
          json: async () => ({ id: 11757, name: "Sword Art Online" }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const result = await fetchTvShowDetailClient(11757, {
      expectedTitle: "Sword Art Online",
    });
    expect(result?.detail.name).toBe("Sword Art Online");
    expect(result?.catalog).toBe("anime");
  });

  it("skips TMDB when catalog is anime", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/tv/11757") {
        return {
          ok: true,
          json: async () => ({ id: 11757, name: "The Shop" }),
        };
      }
      if (url === "/api/anime/11757") {
        return {
          ok: true,
          json: async () => ({ id: 11757, name: "Sword Art Online" }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const result = await fetchTvShowDetailClient(11757, { catalog: "anime" });
    expect(result?.detail.name).toBe("Sword Art Online");
    expect(result?.catalog).toBe("anime");
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "/api/anime/11757",
    ]);
  });

  it("falls back to AniList when TMDB 404s", async () => {
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "/api/tv/154587") {
        return { ok: false, json: async () => ({}) };
      }
      if (url === "/api/anime/154587") {
        return {
          ok: true,
          json: async () => ({ id: 154587, name: "Frieren" }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const result = await fetchTvShowDetailClient(154587);
    expect(result?.detail.name).toBe("Frieren");
    expect(result?.catalog).toBe("anime");
  });
});
