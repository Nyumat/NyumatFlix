import { NextResponse } from "next/server";

import { fetchCalluspirates } from "@/lib/scrape/calluspirates-fetch";
import { rewriteStreamsResponse } from "@/lib/direct/client-streams";
import type { DirectStreamsResponse } from "@/lib/direct/types";
import {
  getCalluspiratesApiUrl,
  isDirectScrapeProviderConfigured,
} from "@/lib/scrape/calluspirates-config";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parsePositiveInt(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export async function GET(request: Request, context: RouteContext) {
  if (!isDirectScrapeProviderConfigured()) {
    return NextResponse.json(
      { error: "Direct playback is not configured" },
      { status: 503 },
    );
  }

  const apiBase = getCalluspiratesApiUrl();
  if (!apiBase) {
    return NextResponse.json(
      { error: "CALLUSPIRATES_API_URL is not configured" },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const tmdbId = Number.parseInt(id, 10);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: "Invalid TV id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const season = parsePositiveInt(url.searchParams.get("season"));
  const episode = parsePositiveInt(url.searchParams.get("episode"));
  if (season == null || episode == null) {
    return NextResponse.json(
      { error: "Query params season and episode are required" },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    const params = new URLSearchParams({
      season: String(season),
      episode: String(episode),
    });
    if (url.searchParams.get("fresh") === "1") {
      params.set("fresh", "1");
    }
    upstream = await fetchCalluspirates(
      `${apiBase}/api/tv/${tmdbId}/streams?${params.toString()}`,
      { timeoutMs: 120_000 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upstream fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: detail || `Upstream ${upstream.status}` },
      { status: upstream.status },
    );
  }

  const payload = (await upstream.json()) as DirectStreamsResponse;
  return NextResponse.json(rewriteStreamsResponse(apiBase, payload));
}
