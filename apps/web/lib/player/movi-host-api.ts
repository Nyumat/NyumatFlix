import type { MoviPlayerElement } from "@/lib/player/player-element";
import type {
  ChapterMarker,
  ExternalQualityEntry,
  PresentationMode,
} from "@/lib/player/player-element";

export type { ChapterMarker, ExternalQualityEntry, PresentationMode };

export type MoviCanCastChangeDetail = {
  canCast: boolean;
};

export const isMoviHostElement = (
  value: unknown,
): value is MoviPlayerElement & MoviHostApi =>
  value instanceof HTMLElement && value.tagName.toLowerCase() === "movi-player";

export type MoviHostApi = {
  setExternalQualities?: (qualities: ExternalQualityEntry[]) => void;
  getExternalQualities?: () => ExternalQualityEntry[];
  setChapterMarkers?: (chapters: ChapterMarker[]) => void;
  getChapterMarkers?: () => ChapterMarker[];
  getPresentationMode?: () => PresentationMode;
  canCast?: () => boolean;
  headers?: Record<string, string> | null;
  source?: string | File | MoviSplitSource | MoviSourceEntry[] | null;
};

export type MoviSourceEntry = {
  src: string;
  type?: string;
};

export type MoviSplitSource = {
  video: MoviSourceEntry;
  audio?: MoviSourceEntry | MoviSourceEntry[];
  subtitles?: Array<{
    id?: string;
    src: string;
    lang: string;
    label: string;
    format?: string;
  }>;
};

export type MoviExternalSubtitleEntry = {
  id?: string;
  src: string;
  lang: string;
  label: string;
  format?: string;
  default?: boolean;
};

export const applyMoviExternalSubtitles = (
  player: MoviPlayerElement,
  subtitles: MoviExternalSubtitleEntry[],
): void => {
  player.setExternalSubtitles?.(subtitles);
};

export const applyMoviExternalQualities = (
  player: MoviPlayerElement,
  qualities: ExternalQualityEntry[],
): void => {
  player.setExternalQualities?.(qualities);
};

export const applyMoviChapterMarkers = (
  player: MoviPlayerElement,
  chapters: ChapterMarker[],
): void => {
  player.setChapterMarkers?.(chapters);
};

export const readMoviPresentationMode = (
  player: MoviPlayerElement,
): PresentationMode | null => player.getPresentationMode?.() ?? null;

export const readMoviCanCast = (player: MoviPlayerElement): boolean =>
  player.canCast?.() ?? false;
