import { NextResponse } from "next/server";

import { getLiveChannels } from "@/lib/live/dulo";

export const maxDuration = 30;

export async function GET() {
  try {
    const guide = await getLiveChannels();

    return NextResponse.json(guide, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Error loading live channels:", error);

    return NextResponse.json(
      { error: "Failed to load live channels" },
      { status: 502 },
    );
  }
}
