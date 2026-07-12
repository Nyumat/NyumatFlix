import {
  isLegacyMovieDetailTabPathSegment,
  isLegacyTvDetailTabPathSegment,
} from "@/lib/media-detail-tab-query";
import {
  isAnilistTvRouteId,
  normalizeAnilistTvRouteSlug,
} from "@/lib/anilist-route-id";
import { isFfsHost } from "@/lib/ffs/require-ffs-host";
import { resolveSiteFlags } from "@/lib/flags/site-flags";
import { readAdminFlagState } from "@/lib/flags/flipt-client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const LEGACY_TAB_QUERY = "tab";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const ffsHost = isFfsHost(host);

  if (
    ffsHost &&
    !pathname.startsWith("/ffs") &&
    !pathname.startsWith("/api/ffs")
  ) {
    return NextResponse.redirect(new URL("/ffs", request.url));
  }

  if (
    !ffsHost &&
    (pathname.startsWith("/ffs") || pathname.startsWith("/api/ffs"))
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const siteFlags = resolveSiteFlags(await readAdminFlagState());

  if (
    !ffsHost &&
    siteFlags.maintenanceMode &&
    pathname.startsWith("/api/scrape")
  ) {
    return NextResponse.json(
      { error: "Playback is temporarily unavailable (maintenance)." },
      { status: 503 },
    );
  }

  if (!siteFlags.liveTvEnabled && pathname.startsWith("/live")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/dev") && process.env.NODE_ENV !== "development") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const tvDetail = pathname.match(/^\/tvshows\/([^/]+)$/);
  if (tvDetail) {
    const [, rawId] = tvDetail;
    if (rawId.startsWith("-") && isAnilistTvRouteId(rawId)) {
      const url = request.nextUrl.clone();
      url.pathname = `/tvshows/${normalizeAnilistTvRouteSlug(rawId)}`;
      return NextResponse.redirect(url);
    }
  }

  const detailOnly = pathname.match(/^\/(tvshows|movies)\/([^/]+)$/);
  if (detailOnly && request.nextUrl.searchParams.has(LEGACY_TAB_QUERY)) {
    const url = request.nextUrl.clone();
    url.searchParams.delete(LEGACY_TAB_QUERY);
    return NextResponse.redirect(url);
  }

  const tvLegacy = pathname.match(/^\/tvshows\/([^/]+)\/([^/]+)$/);
  if (tvLegacy) {
    const [, id, segment] = tvLegacy;
    if (isLegacyTvDetailTabPathSegment(segment)) {
      const url = request.nextUrl.clone();
      url.pathname = `/tvshows/${id}`;
      url.searchParams.delete(LEGACY_TAB_QUERY);
      return NextResponse.redirect(url);
    }
  }

  const movieLegacy = pathname.match(/^\/movies\/([^/]+)\/([^/]+)$/);
  if (movieLegacy) {
    const [, id, segment] = movieLegacy;
    if (isLegacyMovieDetailTabPathSegment(segment)) {
      const url = request.nextUrl.clone();
      url.pathname = `/movies/${id}`;
      url.searchParams.delete(LEGACY_TAB_QUERY);
      return NextResponse.redirect(url);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-search-params",
    request.nextUrl.searchParams.toString(),
  );
  if (siteFlags.maintenanceMode && !ffsHost) {
    requestHeaders.set("x-maintenance-mode", "1");
  }
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
