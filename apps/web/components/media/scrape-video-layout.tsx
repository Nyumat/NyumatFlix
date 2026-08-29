"use client";

import { FullscreenButton } from "@vidstack/react";
import { FullscreenIcon } from "@vidstack/react/icons";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import { useEffect, useMemo, useState } from "react";

import { ScrapeAudioVariantMenu } from "@/components/media/controls/scrape-audio-variant-menu";
import { ScrapeSubtitleConfigureSubmenu } from "@/components/media/controls/scrape-subtitle-configure-submenu";
import type { SubtitleOffsetControlProps } from "@/components/media/controls/scrape-subtitle-offset-controls";
import type { SubtitleAppearance } from "@/lib/playback/subtitle-appearance";
import type { ScrapeAudioVersion } from "@/lib/scrape/types";

type ScrapeAudioVariantControlProps = {
  audioVersions: ScrapeAudioVersion[];
  audioLang: string;
  hardSubLang: string;
  onAudioLangChange: (lang: string) => void;
  onHardSubLangChange: (lang: string) => void;
};

type ScrapeVideoLayoutProps = {
  audioVariant?: ScrapeAudioVariantControlProps;
  subtitleOffset?: SubtitleOffsetControlProps;
  subtitleAppearance?: {
    appearance: SubtitleAppearance;
    onAppearanceChange: (patch: Partial<SubtitleAppearance>) => void;
    onAppearanceReset: () => void;
  };
};

/**
 * Vidstack's DefaultVideoLayout reads Maverick `$props` from context. Rendering
 * it before the player instance is ready (or across HMR remounts) throws
 * "Cannot read properties of undefined (reading '$props')". Gate on mount —
 * the usual fix for Next/Remix + Vidstack.
 */
export function ScrapeVideoLayout({
  audioVariant,
  subtitleOffset,
  subtitleAppearance,
}: ScrapeVideoLayoutProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const settingsMenuItemsStart = useMemo(() => {
    if (!audioVariant) {
      return null;
    }

    return (
      <ScrapeAudioVariantMenu
        audioVersions={audioVariant.audioVersions}
        audioLang={audioVariant.audioLang}
        hardSubLang={audioVariant.hardSubLang}
        onAudioLangChange={audioVariant.onAudioLangChange}
        onHardSubLangChange={audioVariant.onHardSubLangChange}
      />
    );
  }, [audioVariant]);

  const captionsMenuItemsEnd = useMemo(() => {
    if (!subtitleAppearance && !subtitleOffset) {
      return null;
    }

    return (
      <>
        {subtitleAppearance ? (
          <ScrapeSubtitleConfigureSubmenu
            appearance={subtitleAppearance.appearance}
            onAppearanceChange={subtitleAppearance.onAppearanceChange}
            onAppearanceReset={subtitleAppearance.onAppearanceReset}
            offsetSeconds={subtitleOffset?.offsetSeconds}
            onOffsetChange={subtitleOffset?.onOffsetChange}
            hasOffsetTracks={subtitleOffset?.visible}
          />
        ) : null}
      </>
    );
  }, [
    subtitleAppearance,
    subtitleOffset?.offsetSeconds,
    subtitleOffset?.onOffsetChange,
    subtitleOffset?.visible,
  ]);

  if (!mounted) {
    return null;
  }

  return (
    <DefaultVideoLayout
      icons={defaultLayoutIcons}
      slots={{
        settingsMenuItemsStart,
        captionsMenuItemsEnd,
        smallLayout: {
          fullscreenButton: (
            <FullscreenButton
              className="vds-fullscreen-button vds-button"
              target="provider"
            >
              <FullscreenIcon className="vds-icon" />
            </FullscreenButton>
          ),
        },
      }}
    />
  );
}
