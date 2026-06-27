import { fetchImdbTrailerStreams } from "@/lib/imdb-trailer";
import { signedUrlCacheHeaders } from "@/lib/http-cache";
import {
  pickBestVideasyHlsStream,
  pickBestVideasyMp4Stream,
} from "@/lib/videasy-trailer";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

  try {
    const streams = await fetchImdbTrailerStreams(imdbId);
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
