import { NextResponse } from "next/server";

import {
  INTRO_DB_APP_SEGMENTS_ENDPOINT,
  normalizeIntroDbImdbId,
  parseIntroDbAppResponse,
} from "@/lib/playback/introdb";

const REVALIDATE_SECONDS = 24 * 60 * 60;
const MAX_RESPONSE_BYTES = 50_000;
const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

const parseEpisodeCoordinate = (value: string | null): number | null => {
  if (!value || !/^[1-9][0-9]{0,3}$/.test(value)) {
    return null;
  }
  return Number(value);
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const imdbId = normalizeIntroDbImdbId(requestUrl.searchParams.get("imdb_id"));
  const seasonNumber = parseEpisodeCoordinate(
    requestUrl.searchParams.get("season"),
  );
  const episodeNumber = parseEpisodeCoordinate(
    requestUrl.searchParams.get("episode"),
  );

  if (!imdbId || !seasonNumber || !episodeNumber) {
    return NextResponse.json(
      { error: "Invalid IntroDB lookup" },
      { status: 400 },
    );
  }

  const upstreamUrl = new URL(INTRO_DB_APP_SEGMENTS_ENDPOINT);
  upstreamUrl.searchParams.set("imdb_id", imdbId);
  upstreamUrl.searchParams.set("season", String(seasonNumber));
  upstreamUrl.searchParams.set("episode", String(episodeNumber));

  try {
    const response = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (response.status === 404) {
      return NextResponse.json(
        { error: "Segments not found" },
        { status: 404, headers: CACHE_HEADERS },
      );
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: "IntroDB upstream unavailable" },
        { status: 502 },
      );
    }

    const body = await response.text();
    if (body.length > MAX_RESPONSE_BYTES) {
      return NextResponse.json(
        { error: "IntroDB response too large" },
        { status: 502 },
      );
    }

    const input: unknown = JSON.parse(body);
    const parsed = parseIntroDbAppResponse(input, {
      imdbId,
      seasonNumber,
      episodeNumber,
    });
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid IntroDB response" },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "IntroDB upstream unavailable" },
      { status: 502 },
    );
  }
}
