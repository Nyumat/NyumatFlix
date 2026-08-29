import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { NextResponse } from "next/server";

import {
  buildEmptyIntroDbMediaResponse,
  buildIntroDbMediaUrl,
  parseIntroDbSegments,
} from "@/lib/playback/introdb";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";

const REVALIDATE_SECONDS = 24 * 60 * 60;
const MAX_RESPONSE_BYTES = 50_000;
const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

const parsePositiveInteger = (value: string | null): number | null => {
  if (!value || !/^[1-9][0-9]{0,7}$/.test(value)) {
    return null;
  }
  return Number(value);
};

const parseEpisodeCoordinate = (value: string | null): number | null => {
  if (!value || !/^[1-9][0-9]{0,3}$/.test(value)) {
    return null;
  }
  return Number(value);
};

const parseMediaLookup = (requestUrl: URL): PlaybackProgressKey | null => {
  const contentId = parsePositiveInteger(
    requestUrl.searchParams.get("tmdb_id"),
  );
  const durationMs = parsePositiveInteger(
    requestUrl.searchParams.get("duration_ms"),
  );
  if (!contentId || !durationMs) {
    return null;
  }

  const seasonNumber = parseEpisodeCoordinate(
    requestUrl.searchParams.get("season"),
  );
  const episodeNumber = parseEpisodeCoordinate(
    requestUrl.searchParams.get("episode"),
  );

  if (seasonNumber && episodeNumber) {
    return {
      mediaType: "tv",
      contentId,
      seasonNumber,
      episodeNumber,
    };
  }

  if (
    requestUrl.searchParams.has("season") ||
    requestUrl.searchParams.has("episode")
  ) {
    return null;
  }

  return {
    mediaType: "movie",
    contentId,
  };
};

export async function GET(request: Request) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  const requestUrl = new URL(request.url);
  const lookup = parseMediaLookup(requestUrl);
  if (!lookup) {
    return NextResponse.json(
      { error: "Invalid IntroDB lookup" },
      { status: 400 },
    );
  }

  const durationSeconds =
    Number(requestUrl.searchParams.get("duration_ms")) / 1000;
  const upstreamUrl = buildIntroDbMediaUrl(lookup, durationSeconds);
  if (!upstreamUrl) {
    return NextResponse.json(
      { error: "Invalid IntroDB lookup" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (response.status === 404) {
      return NextResponse.json(buildEmptyIntroDbMediaResponse(lookup), {
        headers: CACHE_HEADERS,
      });
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
    const segments = parseIntroDbSegments(input, lookup, durationSeconds);
    if (!segments) {
      return NextResponse.json(
        { error: "Invalid IntroDB response" },
        { status: 502 },
      );
    }

    return NextResponse.json(input, { headers: CACHE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "IntroDB upstream unavailable" },
      { status: 502 },
    );
  }
}
