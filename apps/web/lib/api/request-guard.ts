import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const NYUMAT_CLIENT_HEADER = "x-nyumat-client";
export const NYUMAT_CLIENT_VALUE = "1";

const EXEMPT_PREFIXES = [
  "/api/healthz",
  "/api/auth/",
  "/api/cap/",
  "/api/ffs/",
  // encoded-token playback proxies — media players cannot send custom headers reliably
  "/api/scrape/play/",
  "/api/live/play/",
  "/api/direct/media",
  "/api/direct/transcode/",
] as const;

const isDevBypass = (): boolean => process.env.NODE_ENV === "development";

export const isApiRequestGuardExempt = (pathname: string): boolean =>
  EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );

const hasNyumatClientHeader = (request: NextRequest): boolean =>
  request.headers.get(NYUMAT_CLIENT_HEADER) === NYUMAT_CLIENT_VALUE;

const isUnsafeCrossSiteMutation = (request: NextRequest): boolean => {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return false;
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (!secFetchSite) {
    return false;
  }

  return secFetchSite !== "same-origin" && secFetchSite !== "same-site";
};

export const apiRequestGuardResponse = (
  request: NextRequest,
): NextResponse | null => {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/") || isApiRequestGuardExempt(pathname)) {
    return null;
  }

  if (isDevBypass()) {
    return null;
  }

  if (!hasNyumatClientHeader(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isUnsafeCrossSiteMutation(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
};
