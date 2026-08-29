"use client";

import { Menu } from "@vidstack/react";
import {
  DefaultMenuButton,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";

import type { ScrapeAudioVersion } from "@/lib/scrape/types";

export type ScrapeAudioVariantMenuProps = {
  audioVersions: ScrapeAudioVersion[];
  audioLang: string;
  hardSubLang: string;
  onAudioLangChange: (lang: string) => void;
  onHardSubLangChange: (lang: string) => void;
};

export const shouldShowScrapeAudioVariantMenu = (
  audioVersions: ScrapeAudioVersion[],
  audioLang: string,
): boolean => {
  if (audioVersions.length > 1) {
    return true;
  }

  const active = audioVersions.find((version) => version.lang === audioLang);
  return (active?.hardSubs?.length ?? 0) > 0;
};

const formatAudioVersionLabel = (version: ScrapeAudioVersion) =>
  `${version.label}${version.original ? " (Original)" : ""}`;

export function ScrapeAudioVariantMenu({
  audioVersions,
  audioLang,
  hardSubLang,
  onAudioLangChange,
  onHardSubLangChange,
}: ScrapeAudioVariantMenuProps) {
  const Icons = defaultLayoutIcons;
  const active = audioVersions.find((version) => version.lang === audioLang);
  const hardSubs = active?.hardSubs ?? [];
  const showAudio = audioVersions.length > 1;
  const showHardSubs = hardSubs.length > 0;

  if (!showAudio && !showHardSubs) {
    return null;
  }

  const audioHint = active ? formatAudioVersionLabel(active) : "Default";
  const hardSubHint =
    hardSubLang === "off"
      ? "Off (clean)"
      : (hardSubs.find((track) => track.lang === hardSubLang)?.label ??
        "Off (clean)");

  return (
    <>
      {showAudio ? (
        <Menu.Root className="vds-scrape-audio-menu vds-menu">
          <DefaultMenuButton
            label="Audio"
            hint={audioHint}
            Icon={Icons.Menu.Audio}
          />
          <Menu.Items className="vds-menu-items">
            <Menu.RadioGroup
              className="vds-radio-group"
              value={audioLang}
              onChange={onAudioLangChange}
            >
              {audioVersions.map((version) => (
                <Menu.Radio
                  key={version.lang}
                  className="vds-radio"
                  value={version.lang}
                >
                  <Icons.Menu.RadioCheck className="vds-icon" />
                  <span className="vds-radio-label">
                    {formatAudioVersionLabel(version)}
                  </span>
                </Menu.Radio>
              ))}
            </Menu.RadioGroup>
          </Menu.Items>
        </Menu.Root>
      ) : null}

      {showHardSubs ? (
        <Menu.Root className="vds-scrape-hardsub-menu vds-menu">
          <DefaultMenuButton
            label="Hardsubs"
            hint={hardSubHint}
            Icon={Icons.Menu.Captions}
          />
          <Menu.Items className="vds-menu-items">
            <Menu.RadioGroup
              className="vds-radio-group"
              value={hardSubLang}
              onChange={onHardSubLangChange}
            >
              <Menu.Radio className="vds-radio" value="off">
                <Icons.Menu.RadioCheck className="vds-icon" />
                <span className="vds-radio-label">Off (clean)</span>
              </Menu.Radio>
              {hardSubs.map((track) => (
                <Menu.Radio
                  key={track.lang}
                  className="vds-radio"
                  value={track.lang}
                >
                  <Icons.Menu.RadioCheck className="vds-icon" />
                  <span className="vds-radio-label">{track.label}</span>
                </Menu.Radio>
              ))}
            </Menu.RadioGroup>
          </Menu.Items>
        </Menu.Root>
      ) : null}
    </>
  );
}
