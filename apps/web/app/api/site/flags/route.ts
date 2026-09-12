import { getCachedSiteFlags } from "@/lib/flags/site-flags";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const flags = await getCachedSiteFlags();
    return NextResponse.json(flags, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[site/flags] read failed:", error);
    return NextResponse.json(
      { error: "Failed to load site flags" },
      { status: 503 },
    );
  }
}
