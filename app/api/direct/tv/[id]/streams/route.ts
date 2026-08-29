import { NextResponse } from "next/server";

import { rewriteStreamsResponse } from "@/lib/direct/client-streams";
import { discoverTvStreamsUpstream } from "@/lib/direct/discover-streams-upstream";
import { mintCalluspiratesClientSession } from "@/lib/direct/server-session";
import {
  getCalluspiratesApiUrl,
  isDirectScrapeProviderConfigured,
} from "@/lib/scrape/calluspirates-config";

export const maxDuration = 300;

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

  const fresh = url.searchParams.get("fresh") === "1";
  const quick = url.searchParams.get("quick") === "1";

  try {
    const sessionPromise = mintCalluspiratesClientSession();
    const payload = await discoverTvStreamsUpstream(
      apiBase,
      tmdbId,
      season,
      episode,
      { fresh, quick, signal: request.signal },
    );
    const session = await sessionPromise;
    return NextResponse.json(
      rewriteStreamsResponse(
        session?.apiBase ?? apiBase,
        payload,
        session?.token,
      ),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upstream fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
