import { auth } from "@/auth";
import { db, watchlist } from "@/db/schema";
import { scrobbleToMal } from "@/lib/mal/sync";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const addWatchlistItemSchema = z.object({
  contentId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  status: z
    .enum(["watching", "plan_to_watch", "on_hold", "dropped", "completed"])
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, session.user.id))
      .orderBy(watchlist.updatedAt);

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = addWatchlistItemSchema.parse(body);

    const existing = await db
      .select()
      .from(watchlist)
      .where(
        and(
          eq(watchlist.userId, session.user.id),
          eq(watchlist.contentId, validatedData.contentId),
          eq(watchlist.mediaType, validatedData.mediaType),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Item already in watchlist" },
        { status: 409 },
      );
    }

    const [newItem] = await db
      .insert(watchlist)
      .values({
        userId: session.user.id,
        contentId: validatedData.contentId,
        mediaType: validatedData.mediaType,
        status: validatedData.status || "watching",
      })
      .returning();

    // Scrobble addition to MyAnimeList
    void scrobbleToMal(session.user.id, {
      tmdbId: validatedData.contentId,
      mediaType: validatedData.mediaType,
      status: validatedData.status || "watching",
    });

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Error adding to watchlist:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
