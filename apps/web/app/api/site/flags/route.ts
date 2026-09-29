import { getCachedSiteFlags } from "@/lib/flags/site-flags-server";
import { connection, NextResponse } from "next/server";

export async function GET() {
  // this response is no-store. prerendering it against a 15s cache misses
  // after the warming pass and fails the build.
  await connection();

  try {
    const flags = await getCachedSiteFlags();
    return NextResponse.json(flags, {
      headers: {
        "Cache-Control": "private, no-store",
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
