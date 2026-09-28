import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/ffs/hero-backdrops/route";

describe("ffs hero backdrop search", () => {
  it("hides the endpoint from the main site host", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/ffs/hero-backdrops?query=spider",
        { headers: { host: "localhost:3000" } },
      ),
    );
    expect(response.status).toBe(404);
  });

  it("returns no candidates for a short query", async () => {
    const response = await GET(
      new NextRequest(
        "http://ffs.localhost:3000/api/ffs/hero-backdrops?query=a",
        { headers: { host: "ffs.localhost:3000" } },
      ),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { results: unknown[] };
    expect(body.results).toEqual([]);
  });

  it("returns no backdrop options without a title id", async () => {
    const response = await GET(
      new NextRequest(
        "http://ffs.localhost:3000/api/ffs/hero-backdrops?options=1&mediaType=anime",
        { headers: { host: "ffs.localhost:3000" } },
      ),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { backdrops: unknown[] };
    expect(body.backdrops).toEqual([]);
  });
});
