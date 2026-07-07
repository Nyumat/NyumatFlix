"use client";

import { Captions } from "@vidstack/react";
import {
  DefaultKeyboardDisplay,
  DefaultVideoGestures,
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";

export function ScrapeVideoLayout() {
  return (
    <>
      <Captions className="vds-captions" />
      <DefaultVideoGestures />
      <DefaultKeyboardDisplay
        icons={defaultLayoutIcons.KeyboardDisplay ?? {}}
      />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </>
  );
}
