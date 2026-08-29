import { NextResponse } from "next/server";

import { rewriteStreamsResponse } from "@/lib/direct/client-streams";
import { discoverMovieStreamsUpstream } from "@/lib/direct/discover-streams-upstream";
import { mintCalluspiratesClientSession } from "@/lib/direct/server-session";
import {
  getCalluspiratesApiUrl,
  isDirectScrapeProviderConfigured,
} from "@/lib/scrape/calluspirates-config";

export const maxDuration = 300;

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
  const quick = incoming.searchParams.get("quick") === "1";

  try {
    const sessionPromise = mintCalluspiratesClientSession();
    const payload = await discoverMovieStreamsUpstream(apiBase, tmdbId, {
      fresh,
      quick,
      signal: request.signal,
    });
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
