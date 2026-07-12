"use client";

import type { ScrapeAudioVersion } from "@/lib/scrape/types";

type ScrapeAudioVariantControlsProps = {
  audioVersions: ScrapeAudioVersion[];
  audioLang: string;
  hardSubLang: string;
  onAudioLangChange: (lang: string) => void;
  onHardSubLangChange: (lang: string) => void;
};

export function ScrapeAudioVariantControls({
  audioVersions,
  audioLang,
  hardSubLang,
  onAudioLangChange,
  onHardSubLangChange,
}: ScrapeAudioVariantControlsProps) {
  const active = audioVersions.find((version) => version.lang === audioLang);
  const hardSubs = active?.hardSubs ?? [];

  if (audioVersions.length <= 1 && hardSubs.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute bottom-16 left-3 z-30 flex max-w-[min(100%,28rem)] flex-wrap gap-2">
      {audioVersions.length > 1 ? (
        <label className="flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white/90 backdrop-blur">
          <span className="text-white/50">Audio</span>
          <select
            className="max-w-[9rem] bg-transparent font-medium outline-none"
            value={audioLang}
            onChange={(event) => onAudioLangChange(event.target.value)}
          >
            {audioVersions.map((version) => (
              <option key={version.lang} value={version.lang}>
                {version.label}
                {version.original ? " (Original)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {hardSubs.length > 0 ? (
        <label className="flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white/90 backdrop-blur">
          <span className="text-white/50">Hardsubs</span>
          <select
            className="max-w-[10rem] bg-transparent font-medium outline-none"
            value={hardSubLang}
            onChange={(event) => onHardSubLangChange(event.target.value)}
          >
            <option value="off">Off (clean)</option>
            {hardSubs.map((track) => (
              <option key={track.lang} value={track.lang}>
                {track.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
