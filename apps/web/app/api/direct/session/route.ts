import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { NextResponse } from "next/server";

import { mintCalluspiratesClientSession } from "@/lib/direct/server-session";
import { isDirectScrapeProviderConfigured } from "@/lib/scrape/calluspirates-config";

export async function GET(request: Request) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  if (!isDirectScrapeProviderConfigured()) {
    return NextResponse.json(
      { error: "Direct playback is not configured" },
      { status: 503 },
    );
  }

  try {
    const session = await mintCalluspiratesClientSession();
    if (!session) {
      return NextResponse.json(
        { error: "Could not mint a Direct playback session" },
        { status: 502 },
      );
    }
    return NextResponse.json(session);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upstream fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
