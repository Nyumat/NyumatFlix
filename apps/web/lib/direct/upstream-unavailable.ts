export const DIRECT_UNAVAILABLE_CODE = "direct_unavailable";

export const DIRECT_UNAVAILABLE_MESSAGE = "Direct playback is unavailable";

const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

export class DirectUnavailableError extends Error {
  readonly code = DIRECT_UNAVAILABLE_CODE;

  constructor() {
    super(DIRECT_UNAVAILABLE_MESSAGE);
    this.name = "DirectUnavailableError";
  }
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }
  if ("cause" in error) {
    return readErrorCode(error.cause);
  }
  return null;
}

export function isDirectUpstreamUnreachable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === "AbortError") {
    return false;
  }
  if (error.name === "TimeoutError") {
    return true;
  }
  const code = readErrorCode(error);
  if (code && UNREACHABLE_CODES.has(code)) {
    return true;
  }
  const message = error.message.toLowerCase();
  return message === "fetch failed" || message.includes("econnrefused");
}

export function isDirectUnavailableHttpFailure(
  status: number,
  detail: string,
): boolean {
  const body = detail.toLowerCase();
  if (body.includes(DIRECT_UNAVAILABLE_CODE)) {
    return true;
  }
  if (status === 502 || status === 503) {
    return (
      body.includes("fetch failed") ||
      body.includes("econnrefused") ||
      body.includes("enotfound")
    );
  }
  return false;
}

export function isBrowserDirectNetworkFailure(error: unknown): boolean {
  if (error instanceof DirectUnavailableError) {
    return true;
  }
  if (!(error instanceof Error) || error.name === "AbortError") {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message === "failed to fetch" ||
    message === "load failed" ||
    message === "network error" ||
    message.includes("networkerror") ||
    message.includes(DIRECT_UNAVAILABLE_CODE) ||
    message.includes("fetch failed")
  );
}

export function directUpstreamErrorBody(error: unknown): {
  status: 502 | 503;
  body: { error: string };
} {
  if (isDirectUpstreamUnreachable(error)) {
    return {
      status: 503,
      body: { error: DIRECT_UNAVAILABLE_CODE },
    };
  }
  const message =
    error instanceof Error ? error.message : "Upstream fetch failed";
  return { status: 502, body: { error: message } };
}
