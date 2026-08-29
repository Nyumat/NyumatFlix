export type DirectPlaybackSession = {
  apiBase: string;
  token: string;
};

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

let cached: { session: DirectPlaybackSession; expiresAt: number } | null = null;
let inflight: Promise<DirectPlaybackSession> | null = null;

export async function ensureDirectSession(): Promise<DirectPlaybackSession> {
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.session;
  }
  if (inflight) {
    return inflight;
  }

  inflight = fetch("/api/direct/session", {
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Direct session ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`,
        );
      }
      const payload = (await response.json()) as {
        apiBase?: unknown;
        token?: unknown;
      };
      if (
        typeof payload.apiBase !== "string" ||
        typeof payload.token !== "string" ||
        payload.apiBase.length === 0 ||
        payload.token.length === 0
      ) {
        throw new Error("Direct session response was invalid");
      }
      const session = {
        apiBase: payload.apiBase.replace(/\/$/, ""),
        token: payload.token,
      };
      cached = { session, expiresAt: Date.now() + SESSION_TTL_MS };
      return session;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function resetDirectSessionForTests(): void {
  cached = null;
  inflight = null;
}
