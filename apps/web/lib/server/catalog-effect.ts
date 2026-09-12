import "server-only";

import { Data, Effect, Either } from "effect";

export type CatalogProvider = "anilist" | "kitsu" | "tmdb" | "jikan";

export type CatalogProviderErrorKind =
  | "transport"
  | "timeout"
  | "http"
  | "decode"
  | "graphql";

export class CatalogProviderError extends Data.TaggedError(
  "CatalogProviderError",
)<{
  readonly provider: CatalogProvider;
  readonly kind: CatalogProviderErrorKind;
  readonly message: string;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly cause?: unknown;
}> {}

type NextFetchRequestInit = RequestInit & {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

type FetchResponseOptions = {
  provider: CatalogProvider;
  input: RequestInfo | URL;
  init?: NextFetchRequestInit;
  timeoutMs: number;
};

const transportMessage = (provider: CatalogProvider) =>
  `${provider} request failed`;

export const fetchResponseEffect = ({
  provider,
  input,
  init,
  timeoutMs,
}: FetchResponseOptions): Effect.Effect<Response, CatalogProviderError> =>
  Effect.tryPromise({
    try: (signal) => fetch(input, { ...init, signal }),
    catch: (cause) =>
      new CatalogProviderError({
        provider,
        kind: "transport",
        message: transportMessage(provider),
        cause,
      }),
  }).pipe(
    Effect.timeoutFail({
      duration: `${timeoutMs} millis`,
      onTimeout: () =>
        new CatalogProviderError({
          provider,
          kind: "timeout",
          message: `${provider} request timed out`,
        }),
    }),
  );

export const requireOkResponse = (
  provider: CatalogProvider,
  response: Response,
): Effect.Effect<Response, CatalogProviderError> =>
  response.ok
    ? Effect.succeed(response)
    : Effect.fail(
        new CatalogProviderError({
          provider,
          kind: "http",
          message: `${provider} request failed with status ${response.status}`,
          status: response.status,
        }),
      );

export const readJsonEffect = <T>(
  provider: CatalogProvider,
  response: Response,
): Effect.Effect<T, CatalogProviderError> =>
  Effect.tryPromise({
    try: () => response.json() as Promise<T>,
    catch: (cause) =>
      new CatalogProviderError({
        provider,
        kind: "decode",
        message: `${provider} returned invalid JSON`,
        cause,
      }),
  });

export const runCatalogEffect = async <A, E>(
  effect: Effect.Effect<A, E, never>,
): Promise<A> => {
  const result = await Effect.runPromise(Effect.either(effect));
  if (Either.isLeft(result)) throw result.left;
  return result.right;
};
