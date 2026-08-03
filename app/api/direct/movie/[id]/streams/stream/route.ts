import { NextResponse } from "next/server";

import { fetchCalluspirates } from "@/lib/scrape/calluspirates-fetch";
import {
  getCalluspiratesApiUrl,
  isDirectScrapeProviderConfigured,
} from "@/lib/scrape/calluspirates-config";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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
    return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });
  }

  const incoming = new URL(request.url);
  const params = new URLSearchParams();
  if (incoming.searchParams.get("fresh") === "1") {
    params.set("fresh", "1");
  }
  const query = params.toString();
  const upstreamUrl = `${apiBase}/api/movie/${tmdbId}/streams/stream${query ? `?${query}` : ""}`;

  let upstream: Response;
  try {
    upstream = await fetchCalluspirates(upstreamUrl, {
      timeoutMs: 300_000,
      headers: { Accept: "text/event-stream" },
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
    },
  });
}
