import { auth } from "@/auth";
import { db, watchlist } from "@/db";
import { buildCachedPersonalizedHomeResponse } from "@/lib/server/home-personalized";
import { signedUrlCacheHeaders } from "@/lib/http-cache";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(watchlist.updatedAt);

    const payload = await buildCachedPersonalizedHomeResponse(userId, items);

    return NextResponse.json(payload, {
      status: 200,
      headers: signedUrlCacheHeaders(),
    });
  } catch (error) {
    console.error("Error building personalized home response:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
