import { DEV_CACHE_CONTROL, IS_DEV } from "@/lib/cache-policy";
import { SITE_FLAGS_REVALIDATE_TAG } from "@/lib/flags/flags-sync";
import { getSiteFlags } from "@/lib/flags/site-flags";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

const getCachedSiteFlags = IS_DEV
  ? async () => getSiteFlags()
  : unstable_cache(async () => getSiteFlags(), [SITE_FLAGS_REVALIDATE_TAG], {
      revalidate: 30,
      tags: [SITE_FLAGS_REVALIDATE_TAG],
    });

export async function GET() {
  try {
    const flags = await getCachedSiteFlags();
    return NextResponse.json(flags, {
      headers: {
        "Cache-Control": IS_DEV
          ? DEV_CACHE_CONTROL
          : "public, s-maxage=30, stale-while-revalidate=300",
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
