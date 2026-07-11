"use client";

import { FullscreenButton } from "@vidstack/react";
import { FullscreenIcon } from "@vidstack/react/icons";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";

export function ScrapeVideoLayout() {
  return (
    <DefaultVideoLayout
      icons={defaultLayoutIcons}
      slots={{
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
