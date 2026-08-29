import "server-only";

type CalluspiratesResponseKind = "json" | "binary" | "event-stream";

type CalluspiratesFetchInit = RequestInit & {
  timeoutMs?: number;
  responseKind?: CalluspiratesResponseKind;
};

function defaultAcceptHeader(kind: CalluspiratesResponseKind): string {
  switch (kind) {
    case "binary":
      return "*/*";
    case "event-stream":
      return "text/event-stream";
    default:
      return "application/json";
  }
}

export async function fetchCalluspirates(
  input: string,
  init: CalluspiratesFetchInit = {},
): Promise<Response> {
  const secret = process.env.CALLUSPIRATES_INTERNAL_SECRET?.trim();
  if (!secret) {
    throw new Error("CALLUSPIRATES_INTERNAL_SECRET is not configured");
  }

  const responseKind = init.responseKind ?? "json";
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${secret}`);
  if (!headers.has("Accept")) {
    headers.set("Accept", defaultAcceptHeader(responseKind));
  }

  const timeoutMs = init.timeoutMs ?? 120_000;
  const { timeoutMs: _timeout, responseKind: _kind, ...rest } = init;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  return fetch(input, {
    ...rest,
    headers,
    signal: rest.signal
      ? AbortSignal.any([rest.signal, timeoutSignal])
      : timeoutSignal,
  });
}
