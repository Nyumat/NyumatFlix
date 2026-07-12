import { isLiveTvEnabled } from "@/config/features";
import {
  isLegacyMovieDetailTabPathSegment,
  isLegacyTvDetailTabPathSegment,
} from "@/lib/media-detail-tab-query";
import {
  isAnilistTvRouteId,
  normalizeAnilistTvRouteSlug,
} from "@/lib/anilist-route-id";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const LEGACY_TAB_QUERY = "tab";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isLiveTvEnabled() && pathname.startsWith("/live")) {
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
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
