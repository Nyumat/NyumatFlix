import { auth } from "@/auth";
import {
  exchangeMalAuthCode,
  getBaseUrl,
  handleMalAuthSuccess,
} from "@/lib/mal/oauth";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const PKCE_COOKIE_NAME = "mal_pkce_code_verifier";
const STATE_COOKIE_NAME = "mal_oauth_state";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = getBaseUrl(request.url);

  if (error || !code) {
    console.error("MAL OAuth error response:", { error, errorDescription });
    return NextResponse.redirect(
      new URL(
        `/login/error?error=${encodeURIComponent(error || "AccessDenied")}`,
        baseUrl,
      ),
    );
  }

  const cookieStore = await cookies();
  const storedVerifier = cookieStore.get(PKCE_COOKIE_NAME)?.value;
  const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value;

  if (!storedVerifier || !storedState || storedState !== state) {
    console.error(
      "State or PKCE verification mismatch in MAL OAuth callback:",
      {
        hasStoredVerifier: Boolean(storedVerifier),
        hasStoredState: Boolean(storedState),
        stateMatches: storedState === state,
      },
    );
    return NextResponse.redirect(
      new URL("/login/error?error=OAuthCallbackError", baseUrl),
    );
  }

  try {
    const session = await auth();
    const tokens = await exchangeMalAuthCode(code, storedVerifier, baseUrl);
    const { returnUrl } = await handleMalAuthSuccess(tokens, session?.user?.id);

    return NextResponse.redirect(new URL(returnUrl, baseUrl));
  } catch (err) {
    console.error("Failed to complete MAL OAuth callback:", err);
    return NextResponse.redirect(
      new URL("/login/error?error=CallbackRouteError", baseUrl),
    );
  }
}
