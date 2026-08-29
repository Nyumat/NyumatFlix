import { describe, expect, it } from "vitest";

import type { MediaItem } from "@/lib/domain/typings";
import { detectMediaType } from "@/lib/media/detect-media-type";

describe("detectMediaType", () => {
  it("prefers explicit route media type", () => {
    expect(
      detectMediaType({
        media: { id: 1, title: "Example" } as MediaItem,
        mediaType: "tv",
      }),
    ).toBe("tv");
  });

  it("infers tv from media metadata", () => {
    expect(
      detectMediaType({
        media: { id: 1, name: "Show", media_type: "tv" } as MediaItem,
      }),
    ).toBe("tv");
  });

  it("falls back to pathname when metadata is ambiguous", () => {
    expect(
      detectMediaType({
        media: { id: 1, title: "Example" } as MediaItem,
        pathname: "/tvshows/123",
      }),
    ).toBe("tv");
  });
});
