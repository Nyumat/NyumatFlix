const DEFAULT_CALLBACK_PATH = "/";

const isAuthRoutePath = (value: string): boolean =>
  value === "/login" ||
  value.startsWith("/login/") ||
  value.startsWith("/login?");

export function safeAuthCallbackPath(
  raw: string | null | undefined,
  fallback = DEFAULT_CALLBACK_PATH,
): string {
  if (typeof raw !== "string") {
    return fallback;
  }

  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  if (value.includes("://") || value.includes("\\")) {
    return fallback;
  }
  if (isAuthRoutePath(value)) {
    return fallback;
  }

  return value;
}

export function loginHref(callbackPath?: string | null): string {
  const next = safeAuthCallbackPath(callbackPath);
  if (next === DEFAULT_CALLBACK_PATH) {
    return "/login";
  }
  return `/login?callbackUrl=${encodeURIComponent(next)}`;
}

const appendCallbackUrl = (
  path: string,
  callbackPath?: string | null,
  extra?: URLSearchParams,
): string => {
  const params = extra ? new URLSearchParams(extra) : new URLSearchParams();
  const callback = safeAuthCallbackPath(callbackPath);
  if (callback !== DEFAULT_CALLBACK_PATH) {
    params.set("callbackUrl", callback);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

export function loginErrorHref(
  error: string,
  callbackPath?: string | null,
): string {
  return appendCallbackUrl(
    "/login/error",
    callbackPath,
    new URLSearchParams({ error }),
  );
}

export function loginVerifyHref(options?: {
  callbackUrl?: string | null;
  devLink?: string;
}): string {
  const extra = new URLSearchParams();
  if (options?.devLink) {
    extra.set("devLink", options.devLink);
  }
  return appendCallbackUrl("/login/verify", options?.callbackUrl, extra);
}
