import {
  isLegacyMovieDetailTabPathSegment,
  isLegacyTvDetailTabPathSegment,
} from "@/lib/media-detail-tab-query";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const LEGACY_TAB_QUERY = "tab";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
