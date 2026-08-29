/** Mirrors calluspirates/web/src/lib/playback.ts */

import {
  companionProgressiveTranscodePath,
  isProgressiveTranscodePath,
  isTooHeavyForBrowserPlayback,
} from "@calluspirates/shared";

import type { DirectStream } from "./types";
import {
  pickTrackIndexByLanguage,
  trackMatchesLanguage,
  isJapaneseAudioPreference,
} from "./track-matching";

export type DirectPlaybackEngine = "movi" | "vidstack-hls" | "vidstack-direct";

type StreamNameFields = {
  name: string;
  fileName?: string;
  size?: number | string;
};

function streamNameBlob(stream: StreamNameFields): string {
  return `${stream.fileName ?? ""} ${stream.name}`.toLowerCase();
}

export const looksLikeHeavyMoviRemux = (stream: StreamNameFields): boolean =>
  /remux|complete\.bluray/i.test(streamNameBlob(stream));

const isHeavyBrowserDecode = (
  stream: StreamNameFields & {
    transcodeProfile?: DirectStream["transcodeProfile"];
  },
): boolean => {
  if (looksLikeHeavyMoviRemux(stream)) {
    return true;
  }
  if (
    stream.transcodeProfile === "heavy" ||
    stream.transcodeProfile === "ultra"
  ) {
    return true;
  }
  const blob = streamNameBlob(stream);
  const size = typeof stream.size === "number" ? stream.size : 0;
  const gb = size / 1e9;
  if (
    gb >= 15 &&
    (/\b(2160p|4k|uhd)\b/i.test(blob) ||
      /\b(hevc|x265|h\.?265|av1|truehd|dts|atmos)\b/i.test(blob))
  ) {
    return true;
  }
  return isTooHeavyForBrowserPlayback({
    name: stream.name,
    fileName: stream.fileName,
    size: stream.size,
  });
};

function canUseMoviEngine(stream: DirectStream): boolean {
  if (!isHeavyBrowserDecode(stream)) {
    return true;
  }
  return !stream.fallbackUrl;
}

export const pickEnglishMoviLang = (
  tracks: ReadonlyArray<{ lang: string; label: string }>,
): string | null => {
  const scored = tracks
    .map((track) => {
      const hay = `${track.lang} ${track.label}`.trim();
      let score = 0;
      if (/\bdub\b/i.test(hay)) {
        score = 3;
      } else if (/\b(en|eng|english)\b/i.test(hay)) {
        score = 2;
      }
      return { lang: track.lang, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.lang ?? null;
};

export const pickMoviTrackPrefs = (
  audioTracks: ReadonlyArray<{ lang: string; label: string }>,
  subtitleTracks: ReadonlyArray<{ lang: string; label: string }>,
  preferredAudioLang?: string | null,
): { audioLang: string | null; subtitleLang: string | null } => {
  if (preferredAudioLang) {
    const preferredIndex = pickTrackIndexByLanguage(
      audioTracks,
      preferredAudioLang,
    );
    const audioLang =
      preferredIndex != null
        ? (audioTracks[preferredIndex]?.lang ?? null)
        : pickEnglishMoviLang(audioTracks);
    const audioIsEnglish =
      audioLang != null && trackMatchesLanguage({ lang: audioLang }, "english");
    const wantEnglishSubs =
      isJapaneseAudioPreference(preferredAudioLang) || !audioIsEnglish;

    return {
      audioLang,
      subtitleLang: wantEnglishSubs
        ? pickEnglishMoviLang(subtitleTracks)
        : null,
    };
  }

  const englishAudio = pickEnglishMoviLang(audioTracks);
  if (englishAudio) {
    return { audioLang: englishAudio, subtitleLang: null };
  }

  return {
    audioLang: null,
    subtitleLang: pickEnglishMoviLang(subtitleTracks),
  };
};

type RankedDirectScrapeStream = StreamNameFields & {
  playback?: "hls" | "direct" | "extended";
  browserPlayable?: boolean;
  size?: number;
};

const isBrowserDirectMp4 = (stream: RankedDirectScrapeStream): boolean =>
  stream.playback === "direct" && stream.browserPlayable === true;

export const orderDirectStreamsForScrape = <T extends RankedDirectScrapeStream>(
  ranked: readonly T[],
  preferMultiTrack: boolean,
): T[] => {
  const directMp4 = ranked.filter(isBrowserDirectMp4);
  const extended = ranked.filter((stream) => !isBrowserDirectMp4(stream));
  const light: T[] = [];
  const heavy: T[] = [];

  for (const stream of extended) {
    if (looksLikeHeavyMoviRemux(stream)) {
      heavy.push(stream);
    } else {
      light.push(stream);
    }
  }

  const bySize = (left: T, right: T) =>
    (left.size && left.size > 0 ? left.size : Number.MAX_SAFE_INTEGER) -
    (right.size && right.size > 0 ? right.size : Number.MAX_SAFE_INTEGER);
  light.sort(bySize);
  heavy.sort(bySize);
  const extendedOrdered = [...light, ...heavy];
  const multi = extendedOrdered.filter(looksLikeMultiTrackStream);
  const rest = extendedOrdered.filter(
    (stream) => !looksLikeMultiTrackStream(stream),
  );

  if (preferMultiTrack) {
    return [...multi, ...rest, ...directMp4];
  }

  return [...directMp4, ...extendedOrdered];
};

export function looksLikeMultiTrackStream(stream: StreamNameFields): boolean {
  const blob = streamNameBlob(stream);
  return (
    /\bmulti(?:ple)?(?:[.\-_ ]?(?:audio|audios|sub|subs|subtitle|subtitles|lang|langs|language|languages))?\b/.test(
      blob,
    ) ||
    /\bdual[.\-_ ]?(?:audio|audios|sub|subs|subtitle|subtitles|lang|langs)\b/.test(
      blob,
    ) ||
    /\b(?:ja|jpn|jp|jap|japanese)[.\-_ +/&]+(?:en|eng|english)\b/.test(blob) ||
    /\b(?:en|eng|english)[.\-_ +/&]+(?:ja|jpn|jp|jap|japanese)\b/.test(blob)
  );
}

function looksLikeMkvStream(stream: StreamNameFields): boolean {
  return /\.mkv(?:[?#]|$)/i.test(streamNameBlob(stream));
}

export function shouldRetainMoviEngine(
  stream: StreamNameFields & {
    playbackHint?: DirectStream["playbackHint"];
    size?: number | string;
  },
): boolean {
  if (isHeavyBrowserDecode(stream)) {
    return false;
  }
  if (stream.playbackHint === "movi-first") {
    return true;
  }
  return looksLikeMultiTrackStream(stream);
}

/** True when client-side movi decode should be the first engine tried. */
export function prefersMoviFirstEngine(stream: DirectStream): boolean {
  if (isHeavyBrowserDecode(stream)) {
    return false;
  }
  if (stream.playbackHint === "movi-first") {
    return true;
  }
  return looksLikeMultiTrackStream(stream);
}

/** Browser-native direct mp4 — starts quickly without movi or server transcode. */
export function isFastStartDirectStream(
  stream: DirectStream | null | undefined,
): boolean {
  return Boolean(stream?.browserPlayable && stream.playback === "direct");
}

function addVidstackTranscodeCandidates(
  stream: DirectStream,
  add: (engine: DirectPlaybackEngine) => void,
): void {
  if (!stream.fallbackUrl) {
    return;
  }
  if (isClientProgressiveTranscodePath(stream.fallbackUrl)) {
    add("vidstack-direct");
    return;
  }
  add("vidstack-hls");
  if (clientCompanionProgressiveTranscodePath(stream.fallbackUrl)) {
    add("vidstack-direct");
  }
}

function toRoutingTranscodePath(path: string): string {
  return path.replace("/api/direct/transcode/", "/api/transcode/");
}

function isClientProgressiveTranscodePath(path: string): boolean {
  return isProgressiveTranscodePath(toRoutingTranscodePath(path));
}

export function isDirectProgressiveTranscodePath(path: string): boolean {
  return isClientProgressiveTranscodePath(path);
}

function clientCompanionProgressiveTranscodePath(
  transcodePath: string,
): string | null {
  return companionProgressiveTranscodePath(
    toRoutingTranscodePath(transcodePath),
  );
}

const engineLabel = (
  engine: DirectPlaybackEngine,
  sourceUrl?: string,
): string => {
  if (engine === "movi") return "Client decode";
  if (engine === "vidstack-hls") return "HLS transcode";
  if (sourceUrl && isClientProgressiveTranscodePath(sourceUrl)) {
    return "Progressive transcode";
  }
  return "Direct";
};

export const playbackEngineLabel = engineLabel;

function buildEngineCandidates(stream: DirectStream): DirectPlaybackEngine[] {
  const candidates: DirectPlaybackEngine[] = [];
  const add = (engine: DirectPlaybackEngine) => {
    if (!candidates.includes(engine)) candidates.push(engine);
  };
  const addMovi = () => {
    if (canUseMoviEngine(stream)) {
      add("movi");
    }
  };

  if (stream.playback === "hls" || stream.url.includes(".m3u8")) {
    add("vidstack-hls");
    return candidates;
  }

  if (stream.playback === "direct") {
    if (looksLikeMultiTrackStream(stream)) {
      addMovi();
      add("vidstack-direct");
      if (stream.fallbackUrl) add("vidstack-hls");
      return candidates;
    }
    add("vidstack-direct");
    if (stream.fallbackUrl) add("vidstack-hls");
    return candidates;
  }

  if (stream.playback === "extended") {
    if (prefersMoviFirstEngine(stream)) {
      addMovi();
      addVidstackTranscodeCandidates(stream, add);
      return candidates;
    }

    if (stream.fallbackUrl) {
      if (
        stream.playbackHint !== "hls-first" &&
        supportsWebCodecs() &&
        canUseMoviEngine(stream)
      ) {
        addMovi();
        addVidstackTranscodeCandidates(stream, add);
        return candidates;
      }

      addVidstackTranscodeCandidates(stream, add);
      addMovi();
      return candidates;
    }

    addMovi();
    return candidates;
  }

  if (stream.browserPlayable !== false) {
    add("vidstack-direct");
  }
  if (stream.fallbackUrl) {
    addVidstackTranscodeCandidates(stream, add);
  } else if (
    supportsWebCodecs() ||
    looksLikeMkvStream(stream) ||
    looksLikeHeavyMoviRemux(stream)
  ) {
    addMovi();
  }
  if (candidates.length === 0 && stream.url) {
    addMovi();
  }
  return candidates;
}

export function supportsWebCodecs(): boolean {
  return typeof VideoDecoder !== "undefined";
}

export function selectInitialEngine(
  stream: DirectStream,
): DirectPlaybackEngine | null {
  return buildEngineCandidates(stream)[0] ?? null;
}

export function isStreamPlayable(stream: DirectStream): boolean {
  return Boolean(stream.url) && selectInitialEngine(stream) !== null;
}

export function nextFallbackEngine(
  stream: DirectStream,
  current: DirectPlaybackEngine,
  tried?: ReadonlySet<DirectPlaybackEngine>,
): DirectPlaybackEngine | null {
  if (current === "movi" && shouldRetainMoviEngine(stream)) {
    return null;
  }
  const excluded = new Set(tried);
  excluded.add(current);
  return buildEngineCandidates(stream).find((c) => !excluded.has(c)) ?? null;
}

export function engineSourceUrl(
  stream: DirectStream,
  engine: DirectPlaybackEngine,
): string {
  if (engine === "vidstack-hls") {
    return stream.fallbackUrl ?? stream.url;
  }
  if (engine === "vidstack-direct" && stream.fallbackUrl) {
    if (isClientProgressiveTranscodePath(stream.fallbackUrl)) {
      return stream.fallbackUrl;
    }
    const progressive = clientCompanionProgressiveTranscodePath(
      stream.fallbackUrl,
    );
    if (progressive) {
      return progressive;
    }
  }
  return stream.url;
}

export function engineStreamKind(
  engine: DirectPlaybackEngine,
  sourceUrl?: string,
): "hls" | "mp4" {
  if (engine === "vidstack-hls") {
    return "hls";
  }
  if (engine === "vidstack-direct") {
    return "mp4";
  }
  if (sourceUrl?.includes("/transcode/")) {
    return "hls";
  }
  return "mp4";
}

export function openDownloadUrl(stream: DirectStream): string {
  const path = stream.url.startsWith("http")
    ? stream.url
    : `${window.location.origin}${stream.url}`;
  return path;
}

export function playbackEngineCandidates(
  stream: DirectStream,
): DirectPlaybackEngine[] {
  return buildEngineCandidates(stream);
}

export function toDirectStream(input: {
  url: string;
  fallbackUrl?: string;
  playback?: DirectStream["playback"];
  browserPlayable?: boolean;
  name?: string;
  fileName?: string;
  size?: number | string;
  hash?: string;
  playbackHint?: DirectStream["playbackHint"];
  transcodeProfile?: DirectStream["transcodeProfile"];
  notWebReady?: boolean;
}): DirectStream {
  return {
    name: input.name ?? "Stream",
    resolution: "",
    size: input.size ?? 0,
    url: input.url,
    playback: input.playback,
    fallbackUrl: input.fallbackUrl,
    cached: true,
    hash: input.hash ?? input.url,
    fileName: input.fileName,
    browserPlayable: input.browserPlayable,
    playbackHint: input.playbackHint,
    transcodeProfile: input.transcodeProfile,
    notWebReady: input.notWebReady,
  };
}
