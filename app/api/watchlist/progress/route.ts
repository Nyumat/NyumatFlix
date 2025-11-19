import { auth } from "@/auth";
import { db, watchlist } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateProgressSchema = z.object({
  contentId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  seasonNumber: z.number().int().positive().optional(),
  episodeNumber: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateProgressSchema.parse(body);

    // Only TV shows should have season/episode
    if (validatedData.mediaType === "tv") {
      if (
        validatedData.seasonNumber === undefined ||
        validatedData.episodeNumber === undefined
      ) {
        return NextResponse.json(
          { error: "Season and episode numbers are required for TV shows" },
          { status: 400 },
        );
      }
    }

    // Find existing watchlist item
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
      // Update existing item
      const updateData: {
        lastWatchedSeason?: number | null;
        lastWatchedEpisode?: number | null;
        lastWatchedAt: Date;
        updatedAt: Date;
      } = {
        lastWatchedAt: new Date(),
        updatedAt: new Date(),
      };

      if (validatedData.mediaType === "tv") {
        updateData.lastWatchedSeason = validatedData.seasonNumber!;
        updateData.lastWatchedEpisode = validatedData.episodeNumber!;
      }

      const [updatedItem] = await db
        .update(watchlist)
        .set(updateData)
        .where(eq(watchlist.id, existing[0].id))
        .returning();

      return NextResponse.json({ item: updatedItem }, { status: 200 });
    } else {
      // Create new watchlist item if it doesn't exist
      const [newItem] = await db
        .insert(watchlist)
        .values({
          userId: session.user.id,
          contentId: validatedData.contentId,
          mediaType: validatedData.mediaType,
          status: "watching",
          lastWatchedSeason:
            validatedData.mediaType === "tv"
              ? validatedData.seasonNumber!
              : null,
          lastWatchedEpisode:
            validatedData.mediaType === "tv"
              ? validatedData.episodeNumber!
              : null,
          lastWatchedAt: new Date(),
        })
        .returning();

      return NextResponse.json({ item: newItem }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Error updating watch progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
