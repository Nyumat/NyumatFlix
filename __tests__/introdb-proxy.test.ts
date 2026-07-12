import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/introdb/segments/route";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("IntroDB.app proxy", () => {
  it("rejects invalid lookup parameters without contacting upstream", async () => {
    global.fetch = vi.fn();

    const response = await GET(
      new Request(
        "http://localhost/api/introdb/segments?imdb_id=bad&season=1&episode=1",
      ),
    );

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns a validated, cacheable segment response", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          imdb_id: "tt0903747",
          season: 1,
          episode: 1,
          intro: null,
          recap: null,
          outro: {
            start_ms: 3_431_000,
            end_ms: 3_500_000,
            confidence: 1,
            submission_count: 1,
          },
        }),
        { status: 200 },
      ),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/introdb/segments?imdb_id=tt0903747&season=1&episode=1",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(await response.json()).toEqual({
      imdb_id: "tt0903747",
      season: 1,
      episode: 1,
      intro: null,
      recap: null,
      outro: { start_ms: 3_431_000, end_ms: 3_500_000 },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      new URL(
        "https://api.introdb.app/segments?imdb_id=tt0903747&season=1&episode=1",
      ),
      expect.objectContaining({
        headers: { Accept: "application/json" },
        next: { revalidate: 86_400 },
      }),
    );
  });

  it("negative-caches an upstream miss", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));

    const response = await GET(
      new Request(
        "http://localhost/api/introdb/segments?imdb_id=tt0903747&season=9&episode=9",
      ),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
  });
});
