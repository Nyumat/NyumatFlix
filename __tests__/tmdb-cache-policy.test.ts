import {
  redactTmdbUrl,
  shouldBypassTmdbDataCache,
  tmdbFetchInit,
} from "@/lib/tmdb-cache-policy";
import { describe, expect, it } from "vitest";

describe("TMDB cache policy", () => {
  it("bypasses Next data cache for raw season details", () => {
    expect(shouldBypassTmdbDataCache("/tv/95479/season/1")).toBe(true);
  });

  it("bypasses Next data cache for large appended detail payloads", () => {
    expect(
      shouldBypassTmdbDataCache("/tv/2734", {
        append_to_response: "videos,images,credits",
      }),
    ).toBe(true);
  });

  it("keeps ordinary catalog calls cacheable", () => {
    const init = tmdbFetchInit({
      endpoint: "/tv/popular",
      revalidate: 3600,
    });

    expect(init.cache).toBeUndefined();
    expect(init.next?.revalidate).toBe(3600);
  });

  it("redacts TMDB API keys in logged URLs", () => {
    expect(
      redactTmdbUrl("https://api.themoviedb.org/3/tv/1?api_key=secret&page=1"),
    ).toBe("https://api.themoviedb.org/3/tv/1?api_key=%5Bredacted%5D&page=1");
  });
});
