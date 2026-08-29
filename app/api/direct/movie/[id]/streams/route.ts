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
  const fresh = incoming.searchParams.get("fresh") === "1";
  const upstreamUrl = `${apiBase}/api/movie/${tmdbId}/streams${fresh ? "?fresh=1" : ""}`;

  let upstream: Response;
  try {
    upstream = await fetchCalluspirates(upstreamUrl, {
      timeoutMs: 120_000,
    });
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
