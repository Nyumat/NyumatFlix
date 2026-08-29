import { NextResponse } from "next/server";

import { MalClientError, MalReauthRequiredError } from "./client";

/**
 * Maps a caught error from a MAL API route handler to an appropriate JSON
 * response.
 * - Reauth failures (revoked/expired refresh token) surface as a 401 with a
 *   `reauth_required` code so the client can prompt the user to reconnect.
 * - Network-level failures (timeouts, DNS, reset sockets) surface as a 503
 *   so clients can retry, instead of a generic 500 that looks like a bug in
 *   our own code.
 */
export function malErrorResponse(error: unknown, context: string) {
  console.error(context, error);

  if (error instanceof MalReauthRequiredError) {
    return NextResponse.json(
      { error: "reauth_required", message: error.message },
      { status: 401 },
    );
  }

  if (error instanceof MalClientError && error.isNetworkError) {
    return NextResponse.json(
      { error: "MyAnimeList is currently unreachable. Please try again." },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
