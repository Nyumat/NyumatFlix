import "server-only";

type CalluspiratesFetchInit = RequestInit & {
  timeoutMs?: number;
};

export async function fetchCalluspirates(
  input: string,
  init: CalluspiratesFetchInit = {},
): Promise<Response> {
  const secret = process.env.CALLUSPIRATES_INTERNAL_SECRET?.trim();
  if (!secret) {
    throw new Error("CALLUSPIRATES_INTERNAL_SECRET is not configured");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${secret}`);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const timeoutMs = init.timeoutMs ?? 120_000;
  const { timeoutMs: _timeout, ...rest } = init;

  return fetch(input, {
    ...rest,
    headers,
    signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
  });
}
