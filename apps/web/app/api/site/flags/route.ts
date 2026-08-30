import { DEV_CACHE_CONTROL } from "@/lib/cache-policy";
import { getSiteFlags } from "@/lib/flags/site-flags";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const flags = await getSiteFlags();
    return NextResponse.json(flags, {
      headers: {
        "Cache-Control": DEV_CACHE_CONTROL,
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
