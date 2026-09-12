import "server-only";

import {
  fetchResponseEffect,
  readJsonEffect,
  runCatalogEffect,
  type CatalogProviderError,
} from "@/lib/server/catalog-effect";
import { Effect } from "effect";

export const ANILIST_GRAPHQL_ENDPOINT = "https://graphql.anilist.co";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_MAX_RETRY_WAIT_MS = 4_000;

export type AniListGraphqlError = {
  message?: string;
  status?: number;
};

export type AniListGraphqlBody = {
  query: string;
  variables?: Record<string, unknown>;
};

export type AniListGraphqlPayload<TData> = {
  status: number;
  data: TData | null;
  errors?: AniListGraphqlError[];
};

export type AniListGraphqlFetchOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
  maxRetryWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export class AnilistUnavailableError extends Error {
  constructor(message = "AniList is temporarily unavailable") {
    super(message);
    this.name = "AnilistUnavailableError";
  }
}

export const isAnilistUnavailableError = (
  error: unknown,
): error is AnilistUnavailableError => {
  if (error instanceof AnilistUnavailableError) return true;
  return error instanceof Error && error.name === "AnilistUnavailableError";
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const isAniListRateLimited = (
  status: number,
  errors?: readonly AniListGraphqlError[],
): boolean =>
  status === 429 ||
  (errors ?? []).some(
    (error) =>
      error.status === 429 || /too many requests/i.test(error.message ?? ""),
  );

export const isAniListNotFound = (
  status: number,
  errors?: readonly AniListGraphqlError[],
): boolean =>
  status === 404 ||
  (errors ?? []).some(
    (error) =>
      error.status === 404 || /^not found\.?$/i.test(error.message ?? ""),
  );

export const getAniListRetryDelayMs = (
  response: Response,
  attempt: number,
  options?: { now?: () => number; maxRetryWaitMs?: number },
): number => {
  const maxWait = options?.maxRetryWaitMs ?? DEFAULT_MAX_RETRY_WAIT_MS;
  const retryAfter = Number.parseInt(
    response.headers.get("retry-after") ?? "",
    10,
  );
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1000, maxWait);
  }

  const reset = Number.parseInt(
    response.headers.get("x-ratelimit-reset") ?? "",
    10,
  );
  if (Number.isFinite(reset) && reset > 0) {
    const untilResetMs = reset * 1000 - (options?.now ?? Date.now)();
    if (untilResetMs > 0) {
      return Math.min(untilResetMs, maxWait);
    }
  }

  return Math.min(400 * 2 ** (attempt - 1), maxWait);
};

const inflight = new Map<string, Promise<AniListGraphqlPayload<unknown>>>();
let gateUntilMs = 0;

export const resetAniListGraphqlStateForTests = () => {
  inflight.clear();
  gateUntilMs = 0;
};

const requestKey = (body: AniListGraphqlBody) => JSON.stringify(body);

const waitForGate = async (
  now: () => number,
  wait: (ms: number) => Promise<void>,
  maxRetryWaitMs: number,
) => {
  const remaining = gateUntilMs - now();
  if (remaining <= 0) return;
  await wait(Math.min(remaining, maxRetryWaitMs));
};

const noteRateLimit = (
  response: Response,
  now: () => number,
  maxRetryWaitMs: number,
) => {
  const remaining = response.headers.get("x-ratelimit-remaining");
  if (response.status !== 429 && remaining !== "0") {
    return;
  }

  const delay = getAniListRetryDelayMs(response, 1, { now, maxRetryWaitMs });
  gateUntilMs = Math.max(gateUntilMs, now() + delay);
};

const parsePayloadEffect = <TData>(
  response: Response,
): Effect.Effect<AniListGraphqlPayload<TData>> =>
  readJsonEffect<{
    data?: TData | null;
    errors?: AniListGraphqlError[];
  }>("anilist", response).pipe(
    Effect.map((payload) => ({
      status: response.status,
      data: payload.data ?? null,
      errors: payload.errors,
    })),
    Effect.catchAll(() =>
      Effect.succeed({ status: response.status, data: null }),
    ),
  );

const providerErrorMessage = (error: CatalogProviderError): string => {
  const cause = error.cause;
  return cause instanceof Error ? cause.message : error.message;
};

/** HTTP 200 with no GraphQL payload usually means a truncated or non-JSON body. */
const isAniListDecodeFailure = (
  response: Response,
  payload: AniListGraphqlPayload<unknown>,
) =>
  response.ok && payload.data === null && (payload.errors?.length ?? 0) === 0;

export const fetchAniListGraphqlEffect = <TData>(
  body: AniListGraphqlBody,
  options?: AniListGraphqlFetchOptions,
): Effect.Effect<AniListGraphqlPayload<TData>, AnilistUnavailableError> =>
  Effect.gen(function* () {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const maxRetryWaitMs = options?.maxRetryWaitMs ?? DEFAULT_MAX_RETRY_WAIT_MS;
    const now = options?.now ?? Date.now;
    const wait = options?.sleep ?? sleep;

    let lastPayload: AniListGraphqlPayload<TData> | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      yield* Effect.promise(() => waitForGate(now, wait, maxRetryWaitMs));

      const responseResult = yield* Effect.either(
        fetchResponseEffect({
          provider: "anilist",
          input: ANILIST_GRAPHQL_ENDPOINT,
          timeoutMs,
          init: {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
            },
            body: JSON.stringify(body),
            cache: "no-store",
          },
        }),
      );
      if (responseResult._tag === "Left") {
        if (attempt >= maxAttempts) {
          return yield* Effect.fail(
            new AnilistUnavailableError(
              providerErrorMessage(responseResult.left),
            ),
          );
        }
        yield* Effect.promise(() =>
          wait(Math.min(400 * 2 ** (attempt - 1), maxRetryWaitMs)),
        );
        continue;
      }
      const response = responseResult.right;

      noteRateLimit(response, now, maxRetryWaitMs);
      const payload = yield* parsePayloadEffect<TData>(response);
      lastPayload = payload;

      if (isAniListRateLimited(payload.status, payload.errors)) {
        if (attempt >= maxAttempts) {
          return yield* Effect.fail(new AnilistUnavailableError());
        }
        yield* Effect.promise(() =>
          wait(
            getAniListRetryDelayMs(response, attempt, {
              now,
              maxRetryWaitMs,
            }),
          ),
        );
        continue;
      }

      if (payload.status === 403 || payload.status >= 500) {
        if (attempt >= maxAttempts) {
          return yield* Effect.fail(
            new AnilistUnavailableError(
              `AniList request failed: ${payload.status}`,
            ),
          );
        }
        yield* Effect.promise(() =>
          wait(Math.min(400 * 2 ** (attempt - 1), maxRetryWaitMs)),
        );
        continue;
      }

      if (isAniListDecodeFailure(response, payload)) {
        if (attempt >= maxAttempts) {
          return yield* Effect.fail(
            new AnilistUnavailableError("AniList returned invalid JSON"),
          );
        }
        yield* Effect.promise(() =>
          wait(Math.min(400 * 2 ** (attempt - 1), maxRetryWaitMs)),
        );
        continue;
      }

      return payload;
    }

    return yield* Effect.fail(
      new AnilistUnavailableError(
        lastPayload
          ? `AniList request failed: ${lastPayload.status}`
          : undefined,
      ),
    );
  });

export const fetchAniListGraphql = async <TData>(
  body: AniListGraphqlBody,
  options?: AniListGraphqlFetchOptions,
): Promise<AniListGraphqlPayload<TData>> => {
  const key = requestKey(body);
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<AniListGraphqlPayload<TData>>;
  }

  const promise = runCatalogEffect(
    fetchAniListGraphqlEffect<TData>(body, options),
  ).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise as Promise<AniListGraphqlPayload<unknown>>);
  return promise;
};
