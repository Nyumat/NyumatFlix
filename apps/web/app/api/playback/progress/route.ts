import { auth } from "@/auth";
import {
  bulkUpsertUserPlaybackProgress,
  listUserPlaybackProgress,
} from "@/lib/server/playback-progress";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const playbackEntrySchema = z.object({
  mediaType: z.enum(["movie", "tv"]),
  contentId: z.number().int().positive(),
  seasonNumber: z.number().int().positive().optional(),
  episodeNumber: z.number().int().positive().optional(),
  watchedSeconds: z.number().nonnegative(),
  durationSeconds: z.number().positive(),
  updatedAt: z.number().int().positive().optional(),
});

const bulkPlaybackBodySchema = z.object({
  entries: z.array(playbackEntrySchema).min(1).max(500),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await listUserPlaybackProgress(session.user.id);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error loading playback ledger:", error);
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
    const parsed = bulkPlaybackBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.errors },
        { status: 400 },
      );
    }

    for (const entry of parsed.data.entries) {
      if (
        entry.mediaType === "tv" &&
        (entry.seasonNumber == null || entry.episodeNumber == null)
      ) {
        return NextResponse.json(
          { error: "Season and episode numbers are required for TV entries" },
          { status: 400 },
        );
      }
    }

    await bulkUpsertUserPlaybackProgress(
      session.user.id,
      parsed.data.entries.map((entry) => ({
        mediaType: entry.mediaType,
        contentId: entry.contentId,
        seasonNumber: entry.seasonNumber,
        episodeNumber: entry.episodeNumber,
        watched: entry.watchedSeconds,
        duration: entry.durationSeconds,
        updatedAt: entry.updatedAt ?? Date.now(),
      })),
    );

    const entries = await listUserPlaybackProgress(session.user.id);
    return NextResponse.json({ entries }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Error saving playback ledger:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
