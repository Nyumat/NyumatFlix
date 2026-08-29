import { auth } from "@/auth";
import { accounts, db } from "@/db/schema";
import {
  getMalUserProfile,
  getValidMalAccessToken,
  MalReauthRequiredError,
} from "@/lib/mal/client";
import { malErrorResponse } from "@/lib/mal/error-response";
import type { MalSyncStatusResponse } from "@/lib/mal/types";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<MalSyncStatusResponse>(
        { connected: false },
        { status: 200 },
      );
    }

    let authInfo: Awaited<ReturnType<typeof getValidMalAccessToken>>;
    try {
      authInfo = await getValidMalAccessToken(session.user.id);
    } catch (error) {
      if (error instanceof MalReauthRequiredError) {
        return NextResponse.json<MalSyncStatusResponse>(
          { connected: false, reauthRequired: true },
          { status: 200 },
        );
      }
      throw error;
    }

    if (!authInfo) {
      return NextResponse.json<MalSyncStatusResponse>(
        { connected: false },
        { status: 200 },
      );
    }

    let malUsername: string | null = null;
    let malPicture: string | null = null;

    try {
      const profile = await getMalUserProfile(authInfo.accessToken);
      malUsername = profile.name;
      malPicture = profile.picture ?? null;
    } catch {
      malUsername = null;
    }

    return NextResponse.json<MalSyncStatusResponse>(
      {
        connected: true,
        malUsername,
        malPicture,
      },
      { status: 200 },
    );
  } catch (error) {
    return malErrorResponse(error, "Error checking MAL status:");
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db
      .delete(accounts)
      .where(
        and(
          eq(accounts.userId, session.user.id),
          eq(accounts.provider, "myanimelist"),
        ),
      );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error disconnecting MAL:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
