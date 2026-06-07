import { NextResponse } from "next/server";

import { getLiveChannels } from "@/lib/live/dulo";

export const maxDuration = 90;

const resolveGuideMode = (request: Request) => {
  const params = new URL(request.url).searchParams;

  if (params.get("bootstrap") === "1") {
    return "bootstrap" as const;
  }

  if (params.get("supplemental") === "1") {
    return "supplemental" as const;
  }

  return "full" as const;
};

export async function GET(request: Request) {
  const mode = resolveGuideMode(request);

  try {
    const guide = await getLiveChannels(mode);

    if (guide.channels.length === 0) {
      return NextResponse.json(
        { error: "Live channel guide is unavailable" },
        {
          status: 503,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(guide, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error loading live channels:", error);

    return NextResponse.json(
      { error: "Failed to load live channels" },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
