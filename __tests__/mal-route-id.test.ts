import {
  buildMalAnimeDetailHref,
  fromMalAnimeRouteId,
  isMalAnimeRouteId,
  toMalAnimeRouteSlug,
} from "@/lib/mal/route-id";
import { describe, expect, it } from "vitest";

describe("mal anime route ids", () => {
  it("encodes MAL ids as anime route slugs", () => {
    expect(toMalAnimeRouteSlug(16498)).toBe("mal-16498");
    expect(buildMalAnimeDetailHref(16498)).toBe("/anime/mal-16498");
  });

  it("decodes mal route slugs", () => {
    expect(isMalAnimeRouteId("mal-16498")).toBe(true);
    expect(fromMalAnimeRouteId("mal-16498")).toBe(16498);
    expect(isMalAnimeRouteId("anilist-16498")).toBe(false);
  });
});
