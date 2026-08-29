import { auth } from "@/auth";
import { malErrorResponse } from "@/lib/mal/error-response";
import { pullMalListToWatchlist } from "@/lib/mal/sync";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await pullMalListToWatchlist(session.user.id);
    if (!result.success) {
      const status = result.reauthRequired
        ? 401
        : result.isNetworkError
          ? 503
          : 400;
      return NextResponse.json(
        {
          error: result.reauthRequired
            ? "reauth_required"
            : result.errors[0] || "Failed to sync with MyAnimeList",
          result,
        },
        { status },
      );
    }

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error) {
    return malErrorResponse(error, "Error triggering MAL sync:");
  }
}
