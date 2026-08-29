import { auth } from "@/auth";
import {
  getMalEntryForUser,
  updateMalEntryForUser,
  type UpdateMalEntryInput,
} from "@/lib/mal/entry";
import type { MalListStatus } from "@/lib/mal/constants";
import { malErrorResponse } from "@/lib/mal/error-response";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const optionalPositiveIntQuery = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

const optionalMediaTypeQuery = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.enum(["movie", "tv"]).optional(),
);

const querySchema = z.object({
  malId: optionalPositiveIntQuery,
  anilistId: optionalPositiveIntQuery,
  tmdbId: optionalPositiveIntQuery,
  mediaType: optionalMediaTypeQuery,
  seasonNumber: optionalPositiveIntQuery,
});

const patchSchema = z.object({
  malId: z.number().int().positive().optional(),
  anilistId: z.number().int().positive().optional(),
  tmdbId: z.number().int().positive().optional(),
  mediaType: z.enum(["movie", "tv"]).optional(),
  seasonNumber: z.number().int().positive().optional(),
  status: z
    .enum(["watching", "completed", "on_hold", "dropped", "plan_to_watch"])
    .optional(),
  score: z.number().int().min(0).max(10).optional(),
  numEpisodesWatched: z.number().int().min(0).optional(),
});

const toEntryParams = (
  data: z.infer<typeof querySchema> | z.infer<typeof patchSchema>,
): UpdateMalEntryInput => ({
  malId: data.malId,
  anilistId: data.anilistId,
  tmdbId: data.tmdbId,
  mediaType: data.mediaType,
  seasonNumber: data.seasonNumber,
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = querySchema.safeParse({
      malId: request.nextUrl.searchParams.get("malId"),
      anilistId: request.nextUrl.searchParams.get("anilistId"),
      tmdbId: request.nextUrl.searchParams.get("tmdbId"),
      mediaType: request.nextUrl.searchParams.get("mediaType"),
      seasonNumber: request.nextUrl.searchParams.get("seasonNumber"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const entry = await getMalEntryForUser(
      session.user.id,
      toEntryParams(parsed.data),
    );

    if (!entry) {
      return NextResponse.json(
        { error: "MAL entry not found or not connected" },
        { status: 404 },
      );
    }

    return NextResponse.json({ entry });
  } catch (error) {
    return malErrorResponse(error, "Error fetching MAL entry:");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const entry = await updateMalEntryForUser(session.user.id, {
      ...toEntryParams(parsed.data),
      status: parsed.data.status as MalListStatus | undefined,
      score: parsed.data.score,
      numEpisodesWatched: parsed.data.numEpisodesWatched,
    });

    if (!entry) {
      return NextResponse.json(
        { error: "MAL entry not found or not connected" },
        { status: 404 },
      );
    }

    return NextResponse.json({ entry });
  } catch (error) {
    return malErrorResponse(error, "Error updating MAL entry:");
  }
}
