"use client";

import {
  SettingsCheckboxRow,
  SettingsToggleGroupRow,
} from "@/components/ffs/settings";
import type { ExperienceDefaultsConfig } from "@/lib/flags/experience-defaults";

type ExperienceDefaultsPanelProps = {
  config: ExperienceDefaultsConfig;
  onChange: (config: ExperienceDefaultsConfig) => void;
};

export function ExperienceDefaultsPanel({
  config,
  onChange,
}: ExperienceDefaultsPanelProps) {
  const patch = (partial: Partial<ExperienceDefaultsConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <>
      <SettingsToggleGroupRow
        label="Player"
        value={config.playerEngine}
        options={[
          { value: "vidstack", label: "Vidstack" },
          { value: "movi", label: "Movi" },
        ]}
        onValueChange={(value) => patch({ playerEngine: value })}
      />
      <SettingsCheckboxRow
        id="experience-force-player"
        label="Force player"
        description="Lock everyone to the player above"
        checked={config.forcePlayerEngine}
        onCheckedChange={(value) => patch({ forcePlayerEngine: value })}
      />
      <SettingsToggleGroupRow
        label="DASH engine"
        value={config.dashEngine}
        options={[
          { value: "vidstack", label: "Vidstack" },
          { value: "shaka", label: "Shaka" },
        ]}
        onValueChange={(value) => patch({ dashEngine: value })}
      />
      <SettingsToggleGroupRow
        label="Catalog cards"
        value={config.catalogCardStyle}
        options={[
          { value: "backdrop", label: "Backdrop" },
          { value: "poster", label: "Poster" },
        ]}
        onValueChange={(value) => patch({ catalogCardStyle: value })}
      />
      <SettingsCheckboxRow
        id="experience-lock-card-style"
        label="Lock card style"
        description="Hide the catalog card style setting"
        checked={config.lockCatalogCardStyle}
        onCheckedChange={(value) => patch({ lockCatalogCardStyle: value })}
      />
      <SettingsToggleGroupRow
        label="Anime audio"
        value={config.playbackAudio}
        options={[
          { value: "sub", label: "Sub" },
          { value: "dub", label: "Dub" },
        ]}
        onValueChange={(value) => patch({ playbackAudio: value })}
      />
      <SettingsToggleGroupRow
        label="Resolution"
        value={config.playbackQuality}
        options={[
          { value: "1080p", label: "1080p" },
          { value: "720p", label: "720p" },
          { value: "480p", label: "480p" },
        ]}
        onValueChange={(value) => patch({ playbackQuality: value })}
      />
      <SettingsToggleGroupRow
        label="VidSrc API"
        value={config.vidsrcApi}
        options={[
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
        ]}
        onValueChange={(value) => patch({ vidsrcApi: value })}
      />
      <SettingsToggleGroupRow
        label="VidNest route"
        value={config.vidnestContentType}
        options={[
          { value: "movie", label: "Movie" },
          { value: "tv", label: "TV" },
          { value: "anime", label: "Anime" },
          { value: "animepahe", label: "AnimePahe" },
        ]}
        onValueChange={(value) => patch({ vidnestContentType: value })}
      />
      <SettingsCheckboxRow
        id="experience-english-subtitles"
        label="English subtitles"
        checked={config.englishSubtitles}
        onCheckedChange={(value) => patch({ englishSubtitles: value })}
      />
      <SettingsCheckboxRow
        id="experience-hover-sound"
        label="Hover sound"
        checked={config.hoverSound}
        onCheckedChange={(value) => patch({ hoverSound: value })}
      />
      <SettingsCheckboxRow
        id="experience-hero-trailers"
        label="Hero trailers"
        checked={config.heroTrailers}
        onCheckedChange={(value) => patch({ heroTrailers: value })}
      />
      <SettingsCheckboxRow
        id="experience-ambient-glow"
        label="Ambient glow default"
        checked={config.ambientGlow}
        onCheckedChange={(value) => patch({ ambientGlow: value })}
      />
    </>
  );
}
