import { resolveMediaPeekTarget } from "@/lib/peek/media-peek-target";
import { describe, expect, it } from "vitest";

describe("resolveMediaPeekTarget", () => {
  it("opens movies from an internal href", () => {
    const target = resolveMediaPeekTarget(
      { id: 414, media_type: "movie", title: "Batman" },
      "/movies/414",
    );
    expect(target).toMatchObject({
      mediaType: "movie",
      id: "414",
      contentId: 414,
      href: "/movies/414",
      catalog: null,
    });
  });

  it("marks anime catalog routes", () => {
    const target = resolveMediaPeekTarget(
      { id: 21, media_type: "tv", name: "One Piece" },
      "/anime/anilist-21",
    );
    expect(target).toMatchObject({
      mediaType: "tv",
      id: "anilist-21",
      catalog: "anime",
    });
  });

  it("ignores external and person links", () => {
    expect(
      resolveMediaPeekTarget(
        { id: 1, media_type: "movie", title: "X" },
        "https://example.com/x",
      ),
    ).toBeNull();
    expect(
      resolveMediaPeekTarget(
        { id: 9, media_type: "person", title: "Actor" },
        "/person/9",
      ),
    ).toBeNull();
  });
});
