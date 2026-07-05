const DEFAULT_FLARESOLVERR_URL = "http://localhost:8191/v1";

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

const flareSolverrEndpoint = () =>
  process.env.FLARESOLVERR_URL ?? DEFAULT_FLARESOLVERR_URL;

const flareSolverrRequest = async (
  body: Record<string, unknown>,
): Promise<FlareSolverrResponse | null> => {
  try {
    const response = await fetch(flareSolverrEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as FlareSolverrResponse;
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

export async function flareSolverrGet(
  url: string,
  maxTimeoutMs = 60_000,
  session?: string,
): Promise<{ status: number; body: string; url?: string } | null> {
  const payload = await flareSolverrRequest({
    cmd: "request.get",
    url,
    maxTimeout: maxTimeoutMs,
    ...(session ? { session } : {}),
  });

  if (payload?.status !== "ok" || !payload.solution) {
    return null;
  }

  return {
    status: payload.solution.status ?? 0,
    body: payload.solution.response ?? "",
    url: payload.solution.url,
  };
}
