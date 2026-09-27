import { fetchImdbTrailerStreams } from "@/lib/imdb-trailer";
import { getSiteFlags } from "@/lib/flags/site-flags-server";
import { signedUrlCacheHeaders } from "@/lib/http-cache";
import { resolveImdbIdFromTmdb } from "@/lib/trailer-imdb-resolve";
import {
  pickBestVideasyHlsStream,
  pickBestVideasyMp4Stream,
} from "@/lib/videasy-trailer";
import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { NextResponse } from "next/server";

const IMDB_ID_PATTERN = /^tt\d+$/;

const parseTmdbId = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseMediaType = (value: string | null): "movie" | "tv" | null =>
  value === "movie" || value === "tv" ? value : null;

export async function GET(request: Request) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  const flags = await getSiteFlags();
  if (flags.staticHeroBackdrops) {
    return NextResponse.json(
      { url: null, hlsUrl: null, error: "disabled_by_flag" },
      { status: 200 },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawImdbId = searchParams.get("imdbId")?.trim() ?? "";
  const tmdbId = parseTmdbId(searchParams.get("tmdbId"));
  const mediaType = parseMediaType(searchParams.get("mediaType"));

  const hasImdbParam = rawImdbId.length > 0;
  let imdbId = IMDB_ID_PATTERN.test(rawImdbId) ? rawImdbId : null;
  let resolvedFrom: "imdb" | "tmdb" = "imdb";

  if (!imdbId && tmdbId && mediaType) {
    imdbId = await resolveImdbIdFromTmdb(tmdbId, mediaType);
    resolvedFrom = "tmdb";
  }

  if (!imdbId) {
    // A TMDB id we couldn't resolve is a data gap, not a bad request.
    if (!hasImdbParam && tmdbId && mediaType) {
      return NextResponse.json(
        { url: null, hlsUrl: null, error: "no_imdb_id" },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { url: null, hlsUrl: null, error: "invalid_imdb_id" },
      { status: 400 },
    );
  }

  try {
    const streams = await fetchImdbTrailerStreams(imdbId);
    const url = pickBestVideasyMp4Stream(streams);
    const hlsUrl = pickBestVideasyHlsStream(streams);
    if (!url && !hlsUrl) {
      return NextResponse.json(
        { url: null, hlsUrl: null, error: "no_stream" },
        { status: 200 },
      );
    }

    if (process.env.NODE_ENV === "production") {
      console.info(
        "[videasy] ok",
        imdbId,
        "via",
        resolvedFrom,
        "mp4Len",
        url?.length ?? 0,
        "hlsLen",
        hlsUrl?.length ?? 0,
      );
    }

    return NextResponse.json(
      { url: url ?? null, hlsUrl: hlsUrl ?? null },
      { headers: signedUrlCacheHeaders() },
    );
  } catch {
    if (process.env.NODE_ENV === "production") {
      console.warn("[videasy] fetch failed", imdbId);
    }
    return NextResponse.json(
      { url: null, hlsUrl: null, error: "fetch_failed" },
      { status: 502 },
    );
  }
}
