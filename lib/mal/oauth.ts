import { accounts, db, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { encode as encodeSessionJwt } from "next-auth/jwt";
import { getMalUserProfile } from "./client";
import type { MalTokenResponse } from "./types";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days, matches auth.ts

const MAL_AUTH_URL = "https://myanimelist.net/v1/oauth2/authorize";
const MAL_TOKEN_URL = "https://myanimelist.net/v1/oauth2/token";

const PKCE_COOKIE_NAME = "mal_pkce_code_verifier";
const STATE_COOKIE_NAME = "mal_oauth_state";
const REDIRECT_COOKIE_NAME = "mal_oauth_callback_url";

export function getBaseUrl(requestUrl?: string): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.NEXTAUTH_URL)
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  if (requestUrl) {
    const url = new URL(requestUrl);
    return `${url.protocol}//${url.host}`;
  }
  return "http://localhost:3000";
}

export function getMalRedirectUri(baseUrl: string): string {
  return `${baseUrl}/api/auth/mal/callback`;
}

/**
 * Generates a high-entropy 128-char plain PKCE code_verifier.
 */
export function generatePlainPkceVerifier(): string {
  return crypto.randomBytes(64).toString("hex");
}

/**
 * Builds the MAL authorization URL for plain PKCE flow.
 */
export async function buildMalAuthUrl(
  baseUrl: string,
  returnUrl = "/",
): Promise<{ url: string; verifier: string; state: string }> {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) {
    throw new Error("MAL_CLIENT_ID is not configured");
  }

  const verifier = generatePlainPkceVerifier();
  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = getMalRedirectUri(baseUrl);

  const authUrl = new URL(MAL_AUTH_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("code_challenge", verifier);
  authUrl.searchParams.set("code_challenge_method", "plain");

  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 15, // 15 minutes
  };

  cookieStore.set(PKCE_COOKIE_NAME, verifier, cookieOpts);
  cookieStore.set(STATE_COOKIE_NAME, state, cookieOpts);
  cookieStore.set(REDIRECT_COOKIE_NAME, returnUrl, cookieOpts);

  return { url: authUrl.toString(), verifier, state };
}

/**
 * Exchanges the authorization code for access/refresh tokens.
 */
export async function exchangeMalAuthCode(
  code: string,
  codeVerifier: string,
  baseUrl: string,
): Promise<MalTokenResponse> {
  const clientId = process.env.MAL_CLIENT_ID;
  const clientSecret = process.env.MAL_CLIENT_SECRET;

  if (!clientId) {
    throw new Error("MAL_CLIENT_ID is not configured");
  }

  const redirectUri = getMalRedirectUri(baseUrl);
  const body = new URLSearchParams();
  body.set("client_id", clientId);
  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("code_verifier", codeVerifier);

  let res: Response;
  try {
    res = await fetch(MAL_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("MAL token exchange request failed:", error);
    throw new Error(
      timedOut
        ? "MyAnimeList timed out exchanging the authorization code"
        : "Failed to reach MyAnimeList to exchange the authorization code",
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("MAL token exchange failed:", {
      status: res.status,
      body: data,
    });
    throw new Error(
      data.error_description ||
        data.error ||
        "Failed to exchange authorization code with MAL",
    );
  }

  return data as MalTokenResponse;
}

/**
 * Upserts a MAL account into Drizzle DB and establishes an Auth.js JWT session.
 */
export async function handleMalAuthSuccess(
  tokens: MalTokenResponse,
  currentUserId?: string | null,
): Promise<{ userId: string; returnUrl: string }> {
  const profile = await getMalUserProfile(tokens.access_token);
  const providerAccountId = String(profile.id);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (tokens.expires_in || 2678400);

  let targetUserId = currentUserId;

  if (!targetUserId) {
    // Check if an account already exists with this MAL providerAccountId
    const [existingAccount] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.provider, "myanimelist"),
          eq(accounts.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);

    if (existingAccount) {
      targetUserId = existingAccount.userId;
      // Update tokens
      await db
        .update(accounts)
        .set({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
        })
        .where(
          and(
            eq(accounts.provider, "myanimelist"),
            eq(accounts.providerAccountId, providerAccountId),
          ),
        );
    } else {
      // Create new user for this MAL profile
      const newUserId = crypto.randomUUID();
      await db.insert(users).values({
        id: newUserId,
        name: profile.name,
        email: null,
        image: profile.picture ?? null,
      });

      await db.insert(accounts).values({
        userId: newUserId,
        type: "oauth",
        provider: "myanimelist",
        providerAccountId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        token_type: tokens.token_type,
      });

      targetUserId = newUserId;
    }
  } else {
    // Link MAL account to existing authenticated user
    const [existingAccount] = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, targetUserId),
          eq(accounts.provider, "myanimelist"),
        ),
      )
      .limit(1);

    if (existingAccount) {
      await db
        .update(accounts)
        .set({
          providerAccountId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
        })
        .where(
          and(
            eq(accounts.userId, targetUserId),
            eq(accounts.provider, "myanimelist"),
          ),
        );
    } else {
      await db.insert(accounts).values({
        userId: targetUserId,
        type: "oauth",
        provider: "myanimelist",
        providerAccountId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        token_type: tokens.token_type,
      });
    }
  }

  // auth.ts uses `session: { strategy: "jwt" }`, so the session cookie must
  // be a signed/encrypted JWE, not a raw token looked up in a `sessions`
  // row. Mint one directly with the same secret/salt/maxAge Auth.js itself
  // uses, so this cookie decodes cleanly on the very next request.
  const cookieStore = await cookies();
  const isSecure = process.env.NODE_ENV === "production";
  const cookiePrefix = isSecure ? "__Secure-" : "";
  const sessionCookieName = `${cookiePrefix}authjs.session-token`;

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  const sessionExpires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const sessionJwt = await encodeSessionJwt({
    secret,
    salt: sessionCookieName,
    maxAge: SESSION_MAX_AGE_SECONDS,
    token: {
      uid: targetUserId,
      sub: targetUserId,
      name: profile.name,
      picture: profile.picture ?? null,
    },
  });

  cookieStore.set(sessionCookieName, sessionJwt, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    expires: sessionExpires,
  });

  const returnUrl = cookieStore.get(REDIRECT_COOKIE_NAME)?.value || "/";

  // Clean up transient cookies
  cookieStore.delete(PKCE_COOKIE_NAME);
  cookieStore.delete(STATE_COOKIE_NAME);
  cookieStore.delete(REDIRECT_COOKIE_NAME);

  return { userId: targetUserId, returnUrl };
}
