"use client";

import {
  getTimeRangesEnd,
  isDASHProvider,
  isHLSProvider,
  MediaAnnouncer,
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaErrorDetail,
  type MediaProviderAdapter,
  type MediaPlayerInstance,
} from "@vidstack/react";
import Hls from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ScrapeVideoLayout } from "@/components/media/scrape-video-layout";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { usePlaybackTrackPreferences } from "@/hooks/use-playback-track-preferences";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import { trackMatchesLanguage } from "@/lib/playback/track-matching";
import {
  getTrackPreferences,
  trackPreferenceStorageKey,
} from "@/lib/playback/track-preferences-storage";
import { configureScrapeHlsInstance } from "@/lib/scrape/hls-quality";
import { SCRAPE_VOD_HLS_CONFIG } from "@/lib/scrape/hls-vod-config";
import {
  buildScrapeQualityPlayUrls,
  buildScrapeSubtitleTracks,
} from "@/lib/scrape/player-sources";
import { extractScrapePlaybackRefreshFromPlayUrl } from "@/lib/scrape/playback";
import {
  buildScrapeMediaPlayerSrc,
  type ScrapeStreamKind,
} from "@/lib/scrape/stream-kind";
import type { ScrapeQuality, ScrapeSubtitle } from "@/lib/scrape/types";
import { VIDKING_PROACTIVE_REFRESH_AFTER_MS } from "@/lib/scrape/vidking-constants";
import { cn } from "@/lib/utils";

import "./scrape-hls-player.css";

const VIDKING_KEEPALIVE_INTERVAL_MS = VIDKING_PROACTIVE_REFRESH_AFTER_MS;

const loadDashjsLibrary = () =>
  import("dashjs").then((module) => ({ default: module.MediaPlayer }));

type ScrapeHlsPlayerProps = {
  playUrl: string;
  streamKind?: ScrapeStreamKind;
  qualities?: ScrapeQuality[];
  referer?: string;
  subtitles?: ScrapeSubtitle[];
  title: string;
  poster?: string | null;
  progressKey: PlaybackProgressKey;
  className?: string;
  onFatalError?: () => void;
  onEnded?: () => void;
};

const readBufferedEnd = (player: MediaPlayerInstance): number => {
  const provider = player.provider;
  if (provider && "video" in provider && provider.video) {
    return getTimeRangesEnd(provider.video.buffered) ?? 0;
  }

  return 0;
};

const isSpuriousEndPosition = (player: MediaPlayerInstance) => {
  const { currentTime, duration } = player;
  const bufferedEnd = readBufferedEnd(player);
  if (!Number.isFinite(duration) || duration <= 0) {
    return false;
  }

  return currentTime >= Math.max(0, duration - 1) && bufferedEnd < 1;
};

export function ScrapeHlsPlayer({
  playUrl,
  streamKind = "hls",
  qualities,
  referer,
  subtitles,
  title,
  poster,
  progressKey,
  className,
  onFatalError,
  onEnded,
}: ScrapeHlsPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const resumedRef = useRef(false);
  const startedRef = useRef(false);
  const { resumeTime, persist, persistImmediate } =
    usePlaybackProgress(progressKey);
  const qualityPlayUrls = useMemo(
    () => buildScrapeQualityPlayUrls(playUrl, qualities, referer),
    [playUrl, qualities, referer],
  );
  const [qualityIndex, setQualityIndex] = useState(0);
  const activePlayUrl = qualityPlayUrls[qualityIndex] ?? playUrl;
  const activePlaybackUrl = useMemo(() => {
    if (!activePlayUrl.startsWith("/")) {
      return activePlayUrl;
    }

    try {
      return new URL(activePlayUrl, window.location.href).toString();
    } catch {
      return activePlayUrl;
    }
  }, [activePlayUrl]);
  const playerSrc = useMemo(
    () => buildScrapeMediaPlayerSrc(activePlaybackUrl, streamKind),
    [activePlaybackUrl, streamKind],
  );
  const textTracks = useMemo(() => {
    const tracks = buildScrapeSubtitleTracks(subtitles, referer);
    const savedSubtitleLang = getTrackPreferences(
      trackPreferenceStorageKey(progressKey),
    )?.subtitleLang;

    if (!savedSubtitleLang || savedSubtitleLang === "off") {
      return tracks;
    }

    let matched = false;
    return tracks.map((track) => {
      const isDefault =
        !matched &&
        trackMatchesLanguage(
          { lang: track.lang, label: track.label },
          savedSubtitleLang,
        );

      if (isDefault) {
        matched = true;
      }

      return {
        ...track,
        default: isDefault,
      };
    });
  }, [progressKey, referer, subtitles]);

  usePlaybackTrackPreferences(playerRef, progressKey, activePlayUrl);

  const handleProviderChange = useCallback(
    (provider: MediaProviderAdapter | null) => {
      if (!provider) {
        return;
      }

      if (isHLSProvider(provider)) {
        provider.library = Hls;
        provider.config = SCRAPE_VOD_HLS_CONFIG;
        provider.onInstance((hls) => {
          configureScrapeHlsInstance(hls);
        });
        return;
      }

      if (isDASHProvider(provider)) {
        provider.config = {
          debug: {
            logLevel: 0,
          },
          streaming: {
            cmcd: { enabled: false },
          },
        };
        provider.library = loadDashjsLibrary;
      }
    },
    [],
  );

  const applyResumePosition = useCallback(() => {
    const player = playerRef.current;
    if (!player || resumedRef.current || resumeTime <= 0) {
      return;
    }

    const duration = player.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }

    resumedRef.current = true;
    player.currentTime = Math.min(resumeTime, duration);
  }, [resumeTime]);

  const normalizeSpuriousStartupPosition = useCallback(() => {
    const player = playerRef.current;
    if (!player || resumeTime > 0 || resumedRef.current) {
      return;
    }

    if (!isSpuriousEndPosition(player)) {
      return;
    }

    player.currentTime = 0;
  }, [resumeTime]);

  const handleLoadedMetadata = useCallback(() => {
    normalizeSpuriousStartupPosition();
  }, [normalizeSpuriousStartupPosition]);

  const handleCanPlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    applyResumePosition();
    normalizeSpuriousStartupPosition();

    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    const hasUserActivation =
      typeof navigator !== "undefined" &&
      "userActivation" in navigator &&
      Boolean(
        (
          navigator as Navigator & {
            userActivation?: { hasBeenActive?: boolean };
          }
        ).userActivation?.hasBeenActive,
      );
    if (!hasUserActivation) {
      return;
    }

    void player.play().catch(() => undefined);
  }, [applyResumePosition, normalizeSpuriousStartupPosition]);

  const handleTimeUpdate = useCallback(
    (detail: { currentTime: number }) => {
      const player = playerRef.current;
      if (!player) {
        return;
      }

      persist(detail.currentTime, player.duration);
    },
    [persist],
  );

  const handleEnded = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    persistImmediate(player.currentTime, player.duration);
    onEnded?.();
  }, [onEnded, persistImmediate]);

  const handlePlaybackError = useCallback(
    (_detail: MediaErrorDetail) => {
      if (streamKind === "hls") {
        return;
      }

      if (qualityIndex < qualityPlayUrls.length - 1) {
        setQualityIndex((index) => index + 1);
        return;
      }

      onFatalError?.();
    },
    [onFatalError, qualityIndex, qualityPlayUrls.length, streamKind],
  );

  const handleHlsError = useCallback(
    (detail: { fatal?: boolean }) => {
      if (!detail.fatal) {
        return;
      }

      if (qualityIndex < qualityPlayUrls.length - 1) {
        setQualityIndex((index) => index + 1);
        return;
      }

      onFatalError?.();
    },
    [onFatalError, qualityIndex, qualityPlayUrls.length],
  );

  useEffect(() => {
    setQualityIndex(0);
  }, [qualityPlayUrls]);

  useEffect(() => {
    resumedRef.current = false;
    startedRef.current = false;
  }, [activePlayUrl]);

  useEffect(() => {
    const refresh = extractScrapePlaybackRefreshFromPlayUrl(activePlayUrl);
    if (!refresh) {
      return;
    }

    const keepSessionWarm = () => {
      void fetch(activePlayUrl, {
        method: "GET",
        cache: "no-store",
      }).catch(() => undefined);
    };

    keepSessionWarm();
    const interval = setInterval(
      keepSessionWarm,
      VIDKING_KEEPALIVE_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [activePlayUrl]);

  return (
    <div className={cn("h-full w-full", className)}>
      <MediaPlayer
        key={activePlayUrl}
        ref={playerRef}
        className="nyumat-scrape-player h-full w-full"
        src={playerSrc}
        title={title}
        poster={poster ?? undefined}
        streamType="on-demand"
        playsInline
        load="eager"
        onProviderChange={handleProviderChange}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handlePlaybackError}
        onHlsError={handleHlsError}
      >
        <MediaProvider>
          {textTracks.map((track) => (
            <Track
              key={track.id}
              src={track.src}
              kind="subtitles"
              label={track.label}
              lang={track.lang}
              type={track.type}
              default={track.default}
            />
          ))}
        </MediaProvider>
        <MediaAnnouncer />
        <Poster className="vds-poster" alt="" />
        <ScrapeVideoLayout />
      </MediaPlayer>
    </div>
  );
}
