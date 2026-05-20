import { NextResponse } from "next/server";
import {
  pickBestVideasyHlsStream,
  pickBestVideasyMp4Stream,
  VideasyTrailerPayloadSchema,
} from "@/lib/videasy-trailer";

const IMDB_ID_PATTERN = /^tt\d+$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("imdbId")?.trim() ?? "";

  if (!IMDB_ID_PATTERN.test(imdbId)) {
    return NextResponse.json(
      { url: null, hlsUrl: null, error: "invalid_imdb_id" },
      { status: 400 },
    );
  }

  let upstreamStatus: number | undefined;
  try {
    const upstream = await fetch(
      `https://trailers.videasy.net/getOldestTrailer?id=${encodeURIComponent(imdbId)}`,
      { next: { revalidate: 3600 } },
    );
    upstreamStatus = upstream.status;

    if (!upstream.ok) {
      if (process.env.NODE_ENV === "production") {
        console.warn(
          "[videasy] upstream error",
          imdbId,
          "status",
          upstream.status,
        );
      } else {
        console.warn("[videasy] upstream error", imdbId, upstream.status);
      }
      return NextResponse.json(
        { url: null, hlsUrl: null, error: "upstream_error" },
        { status: 502 },
      );
    }

    const raw: unknown = await upstream.json();
    const parsed = VideasyTrailerPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { url: null, hlsUrl: null, error: "invalid_payload" },
        { status: 502 },
      );
    }

    const streams = parsed.data.trailer?.streams ?? [];
    const url = pickBestVideasyMp4Stream(streams);
    const hlsUrl = pickBestVideasyHlsStream(streams);
    if (!url && !hlsUrl) {
      return NextResponse.json(
        { url: null, hlsUrl: null, error: "no_stream" },
        { status: 404 },
      );
    }

    if (process.env.NODE_ENV === "production") {
      console.info(
        "[videasy] ok",
        imdbId,
        "mp4Len",
        url?.length ?? 0,
        "hlsLen",
        hlsUrl?.length ?? 0,
      );
    }

    return NextResponse.json(
      { url: url ?? null, hlsUrl: hlsUrl ?? null },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    if (process.env.NODE_ENV === "production") {
      console.warn("[videasy] fetch failed", imdbId, "status", upstreamStatus);
    }
    return NextResponse.json(
      { url: null, hlsUrl: null, error: "fetch_failed" },
      { status: 502 },
    );
  }
}
