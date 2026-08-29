const DEFAULT_FLARESOLVERR_URL = "http://localhost:8191/v1";
const DEFAULT_REQUEST_TIMEOUT_MS = 95_000;
const SESSION_TTL_MS = 5 * 60_000;

type FlareSolverrResponse = {
  status?: string;
  message?: string;
  session?: string;
  solution?: {
    status?: number;
    response?: string;
    url?: string;
    cookies?: Array<{ name: string; value: string }>;
  };
};

export type FlareSolverrGetResult =
  | {
      ok: true;
      status: number;
      body: string;
      url?: string;
    }
  | {
      ok: false;
      reason: "request_failed" | "challenge_failed" | "no_solution";
      message?: string;
    };

type PooledSession = {
  id: string;
  createdAt: number;
};

let pooledSession: PooledSession | null = null;
let pooledSessionPromise: Promise<string | null> | null = null;

const flareSolverrEndpoint = () =>
  process.env.FLARESOLVERR_URL ?? DEFAULT_FLARESOLVERR_URL;

const flareSolverrRequest = async (
  body: Record<string, unknown>,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<FlareSolverrResponse | null> => {
  try {
    const response = await fetch(flareSolverrEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    const payload = (await response
      .json()
      .catch(() => null)) as FlareSolverrResponse | null;

    if (!response.ok) {
      return payload ?? { status: "error", message: `HTTP ${response.status}` };
    }

    return payload;
  } catch {
    return null;
  }
};

export async function flareSolverrCreateSession(): Promise<string | null> {
  const payload = await flareSolverrRequest({ cmd: "sessions.create" });
  return payload?.status === "ok" ? (payload.session ?? null) : null;
}

export async function flareSolverrDestroySession(
  session: string,
): Promise<void> {
  await flareSolverrRequest({ cmd: "sessions.destroy", session });
}

/**
 * Reuse a FlareSolverr session across scrapes for SESSION_TTL_MS to avoid
 * paying Cloudflare solve cost on every request.
 */
export async function flareSolverrAcquireSession(): Promise<string | null> {
  const now = Date.now();
  if (pooledSession && now - pooledSession.createdAt < SESSION_TTL_MS) {
    return pooledSession.id;
  }

  if (pooledSessionPromise) {
    return pooledSessionPromise;
  }

  pooledSessionPromise = (async () => {
    if (pooledSession) {
      await flareSolverrDestroySession(pooledSession.id).catch(() => undefined);
      pooledSession = null;
    }

    const session = await flareSolverrCreateSession();
    if (session) {
      pooledSession = { id: session, createdAt: Date.now() };
    }
    return session;
  })();

  try {
    return await pooledSessionPromise;
  } finally {
    pooledSessionPromise = null;
  }
}

/** Drop the pooled session without destroying (e.g. after challenge failure). */
export async function flareSolverrInvalidateSession(): Promise<void> {
  const current = pooledSession;
  pooledSession = null;
  if (current) {
    await flareSolverrDestroySession(current.id).catch(() => undefined);
  }
}

export async function flareSolverrGetResult(
  url: string,
  maxTimeoutMs = 60_000,
  session?: string,
): Promise<FlareSolverrGetResult> {
  const payload = await flareSolverrRequest(
    {
      cmd: "request.get",
      url,
      maxTimeout: maxTimeoutMs,
      ...(session ? { session } : {}),
    },
    maxTimeoutMs + 5_000,
  );

  if (!payload) {
    return { ok: false, reason: "request_failed" };
  }

  if (payload.status !== "ok" || !payload.solution) {
    return {
      ok: false,
      reason: "challenge_failed",
      message: payload.message,
    };
  }

  return {
    ok: true,
    status: payload.solution.status ?? 0,
    body: payload.solution.response ?? "",
    url: payload.solution.url,
  };
}

export async function flareSolverrGet(
  url: string,
  maxTimeoutMs = 60_000,
  session?: string,
): Promise<{ status: number; body: string; url?: string } | null> {
  const result = await flareSolverrGetResult(url, maxTimeoutMs, session);
  if (!result.ok) {
    return null;
  }

  return {
    status: result.status,
    body: result.body,
    url: result.url,
  };
}
