import { NextResponse } from "next/server";

import { fetchCalluspirates } from "@/lib/scrape/calluspirates-fetch";
import {
  getCalluspiratesApiUrl,
  isDirectScrapeProviderConfigured,
} from "@/lib/scrape/calluspirates-config";

export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parsePositiveInt(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") {
    return null;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
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

  const incoming = new URL(request.url);
  const season = parsePositiveInt(incoming.searchParams.get("season"));
  const episode = parsePositiveInt(incoming.searchParams.get("episode"));
  if (season == null || episode == null) {
    return NextResponse.json(
      { error: "Query params season and episode are required" },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    season: String(season),
    episode: String(episode),
  });
  if (incoming.searchParams.get("fresh") === "1") {
    params.set("fresh", "1");
  }

  const upstreamUrl = `${apiBase}/api/tv/${tmdbId}/streams/stream?${params.toString()}`;

  let upstream: Response;
  try {
    upstream = await fetchCalluspirates(upstreamUrl, {
      timeoutMs: 300_000,
      responseKind: "event-stream",
      headers: { Accept: "text/event-stream" },
      signal: request.signal,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upstream fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: detail || `Upstream ${upstream.status}` },
      { status: upstream.status },
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
