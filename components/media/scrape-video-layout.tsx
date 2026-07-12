"use client";

import { FullscreenButton } from "@vidstack/react";
import { FullscreenIcon } from "@vidstack/react/icons";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import { useEffect, useState } from "react";

/**
 * Vidstack's DefaultVideoLayout reads Maverick `$props` from context. Rendering
 * it before the player instance is ready (or across HMR remounts) throws
 * "Cannot read properties of undefined (reading '$props')". Gate on mount —
 * the usual fix for Next/Remix + Vidstack.
 */
export function ScrapeVideoLayout() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

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
