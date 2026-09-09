import { auth } from "@/auth";
import { db, watchlist } from "@/db";
import { scrobbleToMal } from "@/lib/mal/sync";
import { upsertUserPlaybackProgress } from "@/lib/server/playback-progress";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateProgressSchema = z.object({
  contentId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  seasonNumber: z.number().int().positive().optional(),
  episodeNumber: z.number().int().positive().optional(),
  anilistId: z.number().int().positive().optional(),
  episodeCompleted: z.boolean().optional(),
  watchedSeconds: z.number().nonnegative().optional(),
  durationSeconds: z.number().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateProgressSchema.parse(body);

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

    if (
      validatedData.watchedSeconds != null &&
      validatedData.durationSeconds != null
    ) {
      await upsertUserPlaybackProgress(
        session.user.id,
        {
          mediaType: validatedData.mediaType,
          contentId: validatedData.contentId,
          seasonNumber: validatedData.seasonNumber,
          episodeNumber: validatedData.episodeNumber,
        },
        {
          watched: validatedData.watchedSeconds,
          duration: validatedData.durationSeconds,
        },
      );
    }

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
      const updateData: {
        lastWatchedSeason?: number | null;
        lastWatchedEpisode?: number | null;
        lastWatchedAt: Date;
        updatedAt: Date;
        dismissedAt?: null;
      } = {
        lastWatchedAt: new Date(),
        updatedAt: new Date(),
        dismissedAt: null,
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

      void scrobbleToMal(session.user.id, {
        tmdbId: validatedData.contentId,
        mediaType: validatedData.mediaType,
        seasonNumber: validatedData.seasonNumber,
        episodeNumber: validatedData.episodeNumber,
        episodeCompleted: validatedData.episodeCompleted === true,
        anilistId: validatedData.anilistId,
      });

      return NextResponse.json({ item: updatedItem }, { status: 200 });
    }

    const [newItem] = await db
      .insert(watchlist)
      .values({
        userId: session.user.id,
        contentId: validatedData.contentId,
        mediaType: validatedData.mediaType,
        status: "watching",
        lastWatchedSeason:
          validatedData.mediaType === "tv" ? validatedData.seasonNumber! : null,
        lastWatchedEpisode:
          validatedData.mediaType === "tv"
            ? validatedData.episodeNumber!
            : null,
        lastWatchedAt: new Date(),
      })
      .returning();

    void scrobbleToMal(session.user.id, {
      tmdbId: validatedData.contentId,
      mediaType: validatedData.mediaType,
      seasonNumber: validatedData.seasonNumber,
      episodeNumber: validatedData.episodeNumber,
      episodeCompleted: validatedData.episodeCompleted === true,
      anilistId: validatedData.anilistId,
    });

    return NextResponse.json({ item: newItem }, { status: 201 });
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
