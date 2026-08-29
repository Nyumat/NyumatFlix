export const CAP_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export const CAP_SESSION_CLIENT_SAFETY_WINDOW_MS =
  CAP_SESSION_TTL_SECONDS * 1000 - 60 * 60 * 1000;

export const isCapDevBypassEnabled = (): boolean =>
  process.env.NODE_ENV === "development";
