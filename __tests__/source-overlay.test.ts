import { describe, expect, it } from "vitest";

import { videoServers } from "@/lib/stores/server-store";
import {
  ANIME_SCRAPE_PROVIDER_ORDER,
  TMDB_SCRAPE_PROVIDER_ORDER,
} from "@/lib/providers/registry";
import { buildSourceOverlayItems } from "@/lib/scrape/source-overlay";

describe("buildSourceOverlayItems", () => {
  it("lists scrape providers first and embed-only servers sorted by availability", () => {
    const items = buildSourceOverlayItems({
      scrapeItems: [
        {
          providerId: "vidking",
          name: "VidKing",
          status: "pending",
        },
        {
          providerId: "vidnest",
          name: "VidNest",
          status: "waiting",
        },
        {
          providerId: "vidsrc",
          name: "VidSrc",
          status: "waiting",
        },
        {
          providerId: "2embed",
          name: "2Embed",
          status: "waiting",
        },
        {
          providerId: "vidsrc-mirror",
          name: "VidSrc Mirror",
          status: "waiting",
        },
      ],
      embedServers: videoServers,
      availableServerIds: ["vidnest", "vidfast"],
      unavailableServerIds: ["superembed", "111movies"],
    });

    expect(items.slice(0, 5).map((item) => item.id)).toEqual([
      "vidking",
      "vidnest",
      "vidsrc",
      "2embed",
      "vidsrc-mirror",
    ]);

    const embedItems = items.filter((item) => item.kind === "embed");
    expect(embedItems.map((item) => item.id)).toEqual([
      "vidfast",
      "videasy",
      "superembed",
      "111movies",
    ]);
    expect(items.find((item) => item.id === "vidnest")?.kind).toBe("scrape");
    expect(embedItems.find((item) => item.id === "vidfast")?.status).toBe(
      "available",
    );
    expect(embedItems.find((item) => item.id === "superembed")?.status).toBe(
      "unavailable",
    );
  });

  it("includes anime and tmdb scrape providers for combined anime playback", () => {
    const scrapeItems = [
      ...ANIME_SCRAPE_PROVIDER_ORDER.map((providerId) => ({
        providerId,
        name: providerId,
        status: "waiting" as const,
      })),
      ...TMDB_SCRAPE_PROVIDER_ORDER.map((providerId) => ({
        providerId,
        name: providerId,
        status: "waiting" as const,
      })),
    ];

    const items = buildSourceOverlayItems({
      scrapeItems,
      embedServers: videoServers,
      availableServerIds: [],
      unavailableServerIds: [],
    });

    expect(
      items.filter((item) => item.kind === "scrape").map((item) => item.id),
    ).toEqual([...ANIME_SCRAPE_PROVIDER_ORDER, ...TMDB_SCRAPE_PROVIDER_ORDER]);
  });
});
