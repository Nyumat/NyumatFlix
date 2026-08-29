import "server-only";

import { accounts, db } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type {
  MalMyListStatus,
  MalTokenResponse,
  MalUser,
  MalUserAnimeListResponse,
} from "./types";

const MAL_API_BASE = "https://api.myanimelist.net/v2";
const MAL_OAUTH_TOKEN_URL = "https://myanimelist.net/v1/oauth2/token";

/** MAL's API and OAuth endpoints are flaky; fail fast rather than hanging
 * until the OS socket timeout (~60s+) turns a slow upstream into a 500. */
const MAL_FETCH_TIMEOUT_MS = 10_000;

/** MAL API v2 omits gray/black NSFW entries unless `nsfw=true` is set. */
const appendMalNsfwParam = (url: URL): void => {
  url.searchParams.set("nsfw", "true");
};

export class MalClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
    /** True when the request never reached MAL (timeout, DNS, TLS/socket reset). */
    public isNetworkError = false,
    /** True when MAL rejected the refresh/access token itself (revoked, expired,
     * or the user disconnected the app on MAL's side) — retrying won't help,
     * the user needs to reconnect their account. */
    public reauthRequired = false,
  ) {
    super(message);
    this.name = "MalClientError";
  }
}

/**
 * Thrown when MAL has definitively rejected the user's stored credentials
 * (e.g. `invalid_grant` on refresh). Callers should surface a "reconnect
 * MyAnimeList" prompt rather than treating this like a transient failure.
 */
export class MalReauthRequiredError extends MalClientError {
  constructor(
    message = "MyAnimeList authorization has expired. Please reconnect your account.",
  ) {
    super(message, 401, undefined, false, true);
    this.name = "MalReauthRequiredError";
  }
}

/**
 * Wraps `fetch` with a hard timeout and normalizes network-level failures
 * (timeouts, DNS errors, reset sockets) into a `MalClientError` instead of
 * letting them bubble up as raw `TypeError`s after the platform's default
 * socket timeout (which can take 60s+ and surface as an opaque 500).
 */
async function malFetch(
  url: string,
  init: RequestInit,
  timeoutMs = MAL_FETCH_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? `MyAnimeList request timed out after ${timeoutMs}ms: ${url}`
        : `MyAnimeList request failed: ${url}`;
    throw new MalClientError(message, undefined, undefined, true);
  }
}

export type MalAnimeDetails = {
  id: number;
  title: string;
  main_picture?: {
    medium?: string;
    large?: string;
  };
  num_episodes?: number;
  media_type?: string;
  status?: string;
  synopsis?: string;
  my_list_status?: MalMyListStatus | null;
};

export type MalRelatedAnimeNode = {
  id: number;
  title: string;
  media_type?: string;
  alternative_titles?: {
    en?: string | null;
    syn?: string[] | null;
  } | null;
  start_season?: {
    year?: number | null;
    season?: string | null;
  } | null;
};

export type MalRelatedAnimeEdge = {
  node: MalRelatedAnimeNode;
  relation_type: string;
};

export type MalAnimeWithRelated = MalAnimeDetails & {
  alternative_titles?: {
    en?: string | null;
    syn?: string[] | null;
  } | null;
  start_season?: {
    year?: number | null;
    season?: string | null;
  } | null;
  related_anime?: MalRelatedAnimeEdge[] | null;
};

export type MalAnimeEntry = MalAnimeDetails;

/**
 * Public anime details from MAL API v2 (`GET /anime/{anime_id}`).
 * Uses client authentication via `X-MAL-Client-ID` (no user OAuth required).
 * @see https://myanimelist.net/apiconfig/references/api/v2
 */
export async function getMalAnimeDetails(
  malId: number,
  fields = "id,title,main_picture,num_episodes,media_type,status,synopsis",
): Promise<MalAnimeDetails | null> {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) {
    return null;
  }

  const url = new URL(`${MAL_API_BASE}/anime/${malId}`);
  url.searchParams.set("fields", fields);
  appendMalNsfwParam(url);

  let res: Response;
  try {
    res = await malFetch(url.toString(), {
      headers: {
        "X-MAL-Client-ID": clientId,
      },
      next: { revalidate: 3600 },
    } as RequestInit);
  } catch (error) {
    console.warn("getMalAnimeDetails: MAL request failed", malId, error);
    return null;
  }

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as MalAnimeDetails;
}

const MAL_RELATED_FIELDS =
  "id,title,alternative_titles,media_type,start_season,related_anime";

/**
 * Public related-anime graph for franchise fallback when AniList is rate-limited.
 * 404 means the title does not exist. 429/5xx throw so we don't cache a truncated chain.
 */
export async function getMalAnimeWithRelated(
  malId: number,
): Promise<MalAnimeWithRelated | null> {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) {
    return null;
  }

  const url = new URL(`${MAL_API_BASE}/anime/${malId}`);
  url.searchParams.set("fields", MAL_RELATED_FIELDS);
  appendMalNsfwParam(url);

  const res = await malFetch(url.toString(), {
    headers: {
      "X-MAL-Client-ID": clientId,
    },
    next: { revalidate: 3600 },
  } as RequestInit);

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new MalClientError(
      `MAL related-anime fetch returned ${res.status} for ${malId}`,
      res.status,
    );
  }

  return (await res.json()) as MalAnimeWithRelated;
}

/**
 * Fetches anime metadata plus the authenticated user's list entry (if any).
 */
export async function getMalAnimeEntry(
  accessToken: string,
  malId: number,
): Promise<MalAnimeEntry | null> {
  const url = new URL(`${MAL_API_BASE}/anime/${malId}`);
  url.searchParams.set(
    "fields",
    "id,title,num_episodes,media_type,status,my_list_status{status,score,num_episodes_watched,is_rewatching}",
  );
  appendMalNsfwParam(url);

  const res = await malFetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: { revalidate: 0 },
  } as RequestInit);

  if (!res.ok) {
    return null;
  }

  return (await res.json()) as MalAnimeEntry;
}

/**
 * Retrieves and refreshes (if expired) the MAL OAuth access token for a given user.
 */
export async function getValidMalAccessToken(userId: string): Promise<{
  accessToken: string;
  providerAccountId: string;
} | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.provider, "myanimelist")),
    )
    .limit(1);

  if (!account?.access_token) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const isExpired =
    account.expires_at !== null &&
    account.expires_at !== undefined &&
    account.expires_at <= nowSeconds + 60; // 60s buffer

  if (!isExpired) {
    return {
      accessToken: account.access_token,
      providerAccountId: account.providerAccountId,
    };
  }

  // Attempt refresh if refresh_token is present
  if (!account.refresh_token) {
    return {
      accessToken: account.access_token,
      providerAccountId: account.providerAccountId,
    };
  }

  try {
    const refreshed = await refreshMalTokens(account.refresh_token);
    const newExpiresAt = nowSeconds + (refreshed.expires_in || 2678400);

    await db
      .update(accounts)
      .set({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: newExpiresAt,
      })
      .where(
        and(eq(accounts.userId, userId), eq(accounts.provider, "myanimelist")),
      );

    return {
      accessToken: refreshed.access_token,
      providerAccountId: account.providerAccountId,
    };
  } catch (err) {
    if (err instanceof MalClientError && err.reauthRequired) {
      // The stored refresh token is dead — remove the connection so the rest
      // of the app (settings, status checks) shows "disconnected" instead of
      // silently retrying a token that will never work again.
      console.warn(
        "MAL refresh token rejected for user, disconnecting:",
        userId,
        err.message,
      );
      await db
        .delete(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.provider, "myanimelist"),
          ),
        );
      throw new MalReauthRequiredError();
    }

    // Network/timeout or an unexpected MAL error — this may well be
    // transient, so keep using the (possibly stale) access token rather than
    // forcing a reconnect for what could be a blip on MAL's end.
    console.error("Failed to refresh MAL access token for user", userId, err);
    return {
      accessToken: account.access_token,
      providerAccountId: account.providerAccountId,
    };
  }
}

/**
 * Exchanges a MAL refresh token for new access and refresh tokens.
 */
export async function refreshMalTokens(
  refreshToken: string,
): Promise<MalTokenResponse> {
  const clientId = process.env.MAL_CLIENT_ID;
  const clientSecret = process.env.MAL_CLIENT_SECRET;

  if (!clientId) {
    throw new MalClientError("MAL_CLIENT_ID is not configured");
  }

  const body = new URLSearchParams();
  body.set("client_id", clientId);
  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);

  const res = await malFetch(MAL_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // MAL returns 400 + { error: "invalid_grant" } when the refresh token was
    // revoked, expired, or the user disconnected the app on MAL's side — no
    // amount of retrying will fix that, the user must reconnect.
    const isInvalidGrant =
      res.status === 400 &&
      (data.error === "invalid_grant" || data.error === "invalid_request");

    throw new MalClientError(
      data.error_description ||
        data.error ||
        "Failed to refresh token with MyAnimeList",
      res.status,
      data,
      false,
      isInvalidGrant,
    );
  }

  return data as MalTokenResponse;
}

/**
 * Fetches authenticated user's profile from MAL API v2.
 */
export async function getMalUserProfile(accessToken: string): Promise<MalUser> {
  const res = await malFetch(`${MAL_API_BASE}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new MalClientError("Failed to fetch MAL profile", res.status, body);
  }

  return (await res.json()) as MalUser;
}

/**
 * Fetches all anime in the user's MAL list.
 */
export async function getMalUserAnimeList(
  accessToken: string,
  options?: { limit?: number; offset?: number; status?: string },
): Promise<MalUserAnimeListResponse> {
  const url = new URL(`${MAL_API_BASE}/users/@me/animelist`);
  url.searchParams.set(
    "fields",
    "list_status,num_episodes,media_type,status,main_picture",
  );
  url.searchParams.set("limit", String(options?.limit ?? 500));
  if (options?.offset) {
    url.searchParams.set("offset", String(options?.offset));
  }
  if (options?.status) {
    url.searchParams.set("status", options.status);
  }
  appendMalNsfwParam(url);

  const res = await malFetch(
    url.toString(),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    20_000,
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new MalClientError(
      "Failed to fetch user anime list",
      res.status,
      body,
    );
  }

  return (await res.json()) as MalUserAnimeListResponse;
}

/**
 * Updates a specific anime's status/progress in the user's MAL list.
 */
export async function updateMalAnimeListStatus(
  accessToken: string,
  animeId: number,
  status: MalMyListStatus,
): Promise<MalMyListStatus> {
  const url = new URL(`${MAL_API_BASE}/anime/${animeId}/my_list_status`);
  appendMalNsfwParam(url);
  const body = new URLSearchParams();

  if (status.status) body.set("status", status.status);
  if (typeof status.num_episodes_watched === "number") {
    body.set("num_watched_episodes", String(status.num_episodes_watched));
  }
  if (typeof status.score === "number") {
    body.set("score", String(status.score));
  }
  if (typeof status.is_rewatching === "boolean") {
    body.set("is_rewatching", status.is_rewatching ? "1" : "0");
  }

  const res = await malFetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const resBody = await res.json().catch(() => ({}));
    throw new MalClientError(
      `Failed to update MAL status for anime #${animeId}`,
      res.status,
      resBody,
    );
  }

  return (await res.json()) as MalMyListStatus;
}
