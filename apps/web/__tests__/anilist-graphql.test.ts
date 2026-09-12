import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnilistUnavailableError,
  fetchAniListGraphql,
  getAniListRetryDelayMs,
  isAniListNotFound,
  isAniListRateLimited,
  isAnilistUnavailableError,
  resetAniListGraphqlStateForTests,
} from "@/lib/anilist-graphql";

const jsonResponse = (
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

describe("AniList graphql helpers", () => {
  it("detects rate limits from http status and graphql errors", () => {
    expect(isAniListRateLimited(429)).toBe(true);
    expect(
      isAniListRateLimited(200, [
        { message: "Too Many Requests.", status: 429 },
      ]),
    ).toBe(true);
    expect(
      isAniListRateLimited(200, [{ message: "Not Found.", status: 404 }]),
    ).toBe(false);
  });

  it("detects not-found from http status and graphql errors", () => {
    expect(isAniListNotFound(404)).toBe(true);
    expect(
      isAniListNotFound(200, [{ message: "Not Found.", status: 404 }]),
    ).toBe(true);
    expect(isAniListNotFound(200, [{ message: "Too Many Requests." }])).toBe(
      false,
    );
  });

  it("honors retry-after and rate-limit reset headers", () => {
    const retryAfter = new Response(null, {
      headers: { "retry-after": "2" },
    });
    expect(
      getAniListRetryDelayMs(retryAfter, 1, { maxRetryWaitMs: 10_000 }),
    ).toBe(2000);

    const reset = new Response(null, {
      headers: { "x-ratelimit-reset": "1005" },
    });
    expect(
      getAniListRetryDelayMs(reset, 1, {
        now: () => 1_000_000,
        maxRetryWaitMs: 10_000,
      }),
    ).toBe(5000);

    const both = new Response(null, {
      headers: {
        "retry-after": "8",
        "x-ratelimit-reset": "1001",
      },
    });
    expect(
      getAniListRetryDelayMs(both, 4, {
        now: () => 1_000_000,
        maxRetryWaitMs: 4000,
      }),
    ).toBe(4000);

    expect(
      getAniListRetryDelayMs(new Response(null), 5, {
        maxRetryWaitMs: 4000,
      }),
    ).toBe(4000);
  });
});

describe("fetchAniListGraphql", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetAniListGraphqlStateForTests();
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    resetAniListGraphqlStateForTests();
    vi.restoreAllMocks();
  });

  it("does not cache-store anilist requests", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { Media: { id: 11061 } } }),
    );

    await fetchAniListGraphql(
      { query: "query { Media { id } }", variables: { id: 11061 } },
      { sleep: async () => undefined },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graphql.anilist.co",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("retries graphql 429 payloads instead of treating them as a miss", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: { Media: null },
            errors: [{ message: "Too Many Requests." }],
          },
          { headers: { "retry-after": "0" } },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { Media: { id: 11061 } } }));

    const payload = await fetchAniListGraphql<{ Media: { id: number } | null }>(
      { query: "query { Media { id } }", variables: { id: 11061 } },
      { sleep: async () => undefined, maxRetryWaitMs: 0 },
    );

    expect(payload.data?.Media?.id).toBe(11061);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws unavailable after persistent rate limits", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { errors: [{ message: "Too Many Requests.", status: 429 }] },
        { status: 429, headers: { "retry-after": "0" } },
      ),
    );

    await expect(
      fetchAniListGraphql(
        { query: "query { Media { id } }", variables: { id: 21 } },
        { sleep: async () => undefined, maxAttempts: 2, maxRetryWaitMs: 0 },
      ),
    ).rejects.toBeInstanceOf(AnilistUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries 403 responses", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, { status: 403 }))
      .mockResolvedValueOnce(jsonResponse({ data: { Media: { id: 21 } } }));

    const payload = await fetchAniListGraphql<{
      Media: { id: number } | null;
    }>(
      { query: "query { Media { id } }", variables: { id: 21 } },
      { sleep: async () => undefined, maxAttempts: 2 },
    );

    expect(payload.data?.Media?.id).toBe(21);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries timeouts and aborts each underlying request", async () => {
    let abortCount = 0;
    fetchMock.mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            abortCount += 1;
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    await expect(
      fetchAniListGraphql(
        { query: "query { Media { id } }", variables: { id: 21 } },
        {
          sleep: async () => undefined,
          timeoutMs: 1,
          maxAttempts: 2,
        },
      ),
    ).rejects.toBeInstanceOf(AnilistUnavailableError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(abortCount).toBe(2);
  });

  it("retries transport failures and server errors up to the exact limit", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("socket closed"))
      .mockResolvedValueOnce(jsonResponse({}, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ data: { Media: { id: 21 } } }));

    const payload = await fetchAniListGraphql<{
      Media: { id: number } | null;
    }>(
      { query: "query { Media { id } }", variables: { id: 21 } },
      { sleep: async () => undefined, maxAttempts: 3, maxRetryWaitMs: 0 },
    );

    expect(payload.data?.Media?.id).toBe(21);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry 404 or ordinary graphql errors", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { errors: [{ message: "Not Found.", status: 404 }] },
        { status: 404 },
      ),
    );
    const notFound = await fetchAniListGraphql(
      { query: "query { Media { id } }", variables: { id: 404 } },
      { sleep: async () => undefined },
    );
    expect(notFound.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ errors: [{ message: "Validation failed" }] }),
    );
    const graphqlError = await fetchAniListGraphql(
      { query: "invalid query" },
      { sleep: async () => undefined },
    );
    expect(graphqlError.errors?.[0]?.message).toBe("Validation failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries malformed json and fails unavailable after the attempt limit", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(
      fetchAniListGraphql(
        { query: "query { Media { id } }" },
        {
          sleep: async () => undefined,
          maxAttempts: 2,
          maxRetryWaitMs: 0,
        },
      ),
    ).rejects.toBeInstanceOf(AnilistUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("recovers when malformed json is transient", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("not json", { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ data: { Media: { id: 21 } } }));

    const payload = await fetchAniListGraphql<{ Media: { id: number } | null }>(
      { query: "query { Media { id } }", variables: { id: 21 } },
      { sleep: async () => undefined, maxRetryWaitMs: 0 },
    );

    expect(payload.data?.Media?.id).toBe(21);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("coalesces in-flight requests for the same query", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = fetchAniListGraphql(
      {
        query: "query { Media { id } }",
        variables: { id: 20 },
      },
      { sleep: async () => undefined },
    );
    const second = fetchAniListGraphql(
      {
        query: "query { Media { id } }",
        variables: { id: 20 },
      },
      { sleep: async () => undefined },
    );

    await vi.waitFor(() => {
      expect(resolveFetch).toBeTypeOf("function");
    });
    resolveFetch?.(jsonResponse({ data: { Media: { id: 20 } } }));
    const [left, right] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(left.data).toEqual(right.data);
  });
});

describe("isAnilistUnavailableError", () => {
  it("matches by class and by name", () => {
    const wrapped = new Error("AniList is temporarily unavailable");
    wrapped.name = "AnilistUnavailableError";
    expect(isAnilistUnavailableError(new AnilistUnavailableError())).toBe(true);
    expect(isAnilistUnavailableError(wrapped)).toBe(true);
    expect(isAnilistUnavailableError(new Error("nope"))).toBe(false);
  });
});
