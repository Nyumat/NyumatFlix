import { auth } from "@/auth";
import { db, watchlist } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateWatchlistItemSchema = z.object({
  status: z.enum(["watching", "waiting", "finished"]).optional(),
  lastWatchedSeason: z.number().int().positive().nullable().optional(),
  lastWatchedEpisode: z.number().int().positive().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const params = await props.params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateWatchlistItemSchema.parse(body);

    // Check if item exists and belongs to user
    const existing = await db
      .select()
      .from(watchlist)
      .where(
        and(eq(watchlist.id, params.id), eq(watchlist.userId, session.user.id)),
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Watchlist item not found" },
        { status: 404 },
      );
    }

    // Update the item
    const updateData: {
      status?: "watching" | "waiting" | "finished";
      lastWatchedSeason?: number | null;
      lastWatchedEpisode?: number | null;
      lastWatchedAt?: Date;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
    }
    if (validatedData.lastWatchedSeason !== undefined) {
      updateData.lastWatchedSeason = validatedData.lastWatchedSeason;
    }
    if (validatedData.lastWatchedEpisode !== undefined) {
      updateData.lastWatchedEpisode = validatedData.lastWatchedEpisode;
      updateData.lastWatchedAt = new Date();
    }

    const [updatedItem] = await db
      .update(watchlist)
      .set(updateData)
      .where(
        and(eq(watchlist.id, params.id), eq(watchlist.userId, session.user.id)),
      )
      .returning();

    return NextResponse.json({ item: updatedItem }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Error updating watchlist item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const params = await props.params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if item exists and belongs to user
    const existing = await db
      .select()
      .from(watchlist)
      .where(
        and(eq(watchlist.id, params.id), eq(watchlist.userId, session.user.id)),
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Watchlist item not found" },
        { status: 404 },
      );
    }

    // Delete the item
    await db
      .delete(watchlist)
      .where(
        and(eq(watchlist.id, params.id), eq(watchlist.userId, session.user.id)),
      );

    return NextResponse.json(
      { message: "Item removed from watchlist" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting watchlist item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
