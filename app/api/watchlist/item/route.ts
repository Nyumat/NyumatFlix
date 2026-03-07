import { auth } from "@/auth";
import { db, watchlist } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ item: null }, { status: 200 });
    }

    const searchParams = request.nextUrl.searchParams;
    const contentId = searchParams.get("contentId");
    const mediaType = searchParams.get("mediaType");

    if (!contentId || !mediaType) {
      return NextResponse.json(
        { error: "Missing contentId or mediaType" },
        { status: 400 },
      );
    }

    if (mediaType !== "movie" && mediaType !== "tv") {
      return NextResponse.json(
        { error: "Invalid mediaType. Must be 'movie' or 'tv'" },
        { status: 400 },
      );
    }

    const [item] = await db
      .select()
      .from(watchlist)
      .where(
        and(
          eq(watchlist.userId, session.user.id),
          eq(watchlist.contentId, parseInt(contentId, 10)),
          eq(watchlist.mediaType, mediaType),
        ),
      )
      .limit(1);

    return NextResponse.json({ item: item || null }, { status: 200 });
  } catch (error) {
    console.error("Error fetching watchlist item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
