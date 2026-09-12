import { auth } from "@/auth";
import { dismissWatchlistTitle } from "@/lib/server/playback-progress";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const dismissSchema = z.object({
  contentId: z.number().int().positive(),
  mediaType: z.enum(["movie", "tv"]),
  dismissedAt: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = dismissSchema.parse(body);
    await dismissWatchlistTitle(
      session.user.id,
      validated.mediaType,
      validated.contentId,
      new Date(validated.dismissedAt ?? Date.now()),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Error dismissing continue watching title:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
