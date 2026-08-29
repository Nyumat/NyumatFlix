import { resolveDetailParentRoute } from "@/components/media/media-detail-route-metadata";
import { describe, expect, test } from "vitest";

describe("resolveDetailParentRoute", () => {
  test("returns anime for TV detail pages with anilistId", () => {
    expect(resolveDetailParentRoute("tv", 154587)).toBe("/anime");
  });

  test("returns anime for movie detail pages with anilistId", () => {
    expect(resolveDetailParentRoute("movie", 154587)).toBe("/anime");
  });

  test("returns tvshows when anilistId is absent on TV pages", () => {
    expect(resolveDetailParentRoute("tv", null)).toBe("/tvshows");
  });

  test("returns movies when anilistId is absent on movie pages", () => {
    expect(resolveDetailParentRoute("movie", undefined)).toBe("/movies");
  });
});
