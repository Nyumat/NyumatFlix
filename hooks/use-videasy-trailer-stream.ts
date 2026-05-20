"use client";

import { useEffect, useState } from "react";

export type VideasyTrailerStreamStatus = "idle" | "loading" | "ready" | "error";

export interface UseVideasyTrailerStreamResult {
  mp4Url: string | null;
  hlsUrl: string | null;
  status: VideasyTrailerStreamStatus;
}

const parseBody = (
  body: unknown,
): { mp4: string | null; hls: string | null } => {
  if (!body || typeof body !== "object") {
    return { mp4: null, hls: null };
  }
  const o = body as { url?: unknown; hlsUrl?: unknown };
  const mp4 = typeof o.url === "string" && o.url.length > 0 ? o.url : null;
  const hls =
    typeof o.hlsUrl === "string" && o.hlsUrl.length > 0 ? o.hlsUrl : null;
  return { mp4, hls };
};

export const useVideasyTrailerStream = (
  imdbId: string | undefined,
  enabled: boolean,
): UseVideasyTrailerStreamResult => {
  const [mp4Url, setMp4Url] = useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<VideasyTrailerStreamStatus>("idle");

  useEffect(() => {
    if (!enabled || !imdbId?.startsWith("tt")) {
      setMp4Url(null);
      setHlsUrl(null);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setMp4Url(null);
    setHlsUrl(null);

    const run = async () => {
      try {
        const res = await fetch(
          `/api/trailers/videasy?imdbId=${encodeURIComponent(imdbId)}`,
          { signal: controller.signal },
        );
        const body: unknown = await res.json().catch(() => null);
        if (controller.signal.aborted) {
          return;
        }

        if (!res.ok) {
          setMp4Url(null);
          setHlsUrl(null);
          setStatus("error");
          return;
        }

        const { mp4, hls } = parseBody(body);
        if (!mp4 && !hls) {
          setMp4Url(null);
          setHlsUrl(null);
          setStatus("error");
          return;
        }

        setMp4Url(mp4);
        setHlsUrl(hls);
        setStatus("ready");
      } catch (e) {
        if (controller.signal.aborted) {
          return;
        }
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        setMp4Url(null);
        setHlsUrl(null);
        setStatus("error");
      }
    };

    void run();

    return () => controller.abort();
  }, [imdbId, enabled]);

  return { mp4Url, hlsUrl, status };
};
