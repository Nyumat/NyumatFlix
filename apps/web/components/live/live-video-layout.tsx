"use client";

import { useEffect, useState } from "react";
import { Captions, LiveButton, Title, useMediaState } from "@vidstack/react";
import {
  DefaultKeyboardDisplay,
  DefaultVideoGestures,
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import {
  GoogleCastErrorListener,
  LiveGoogleCastButton,
} from "@/components/live/live-google-cast-handler";
import { LiveShareChannelButton } from "@/components/live/live-share-channel-button";

const controlsSpacer = (
  <div className="vds-controls-spacer" aria-hidden="true" />
);

const liveControlSlots = {
  seekBackwardButton: null,
  seekForwardButton: null,
  chaptersMenu: null,
  chapterTitle: null,
  captionButton: controlsSpacer,
  startDuration: null,
  endTime: null,
  timeSlider: null,
  downloadButton: null,
} as const;

export function LiveVideoLayout() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const channelControls = {
    liveButton: <LiveChannelMeta />,
    googleCastButton: (
      <>
        <LiveShareChannelButton />
        <LiveGoogleCastButton />
      </>
    ),
  };

  return (
    <>
      <Captions className="vds-captions" />
      <DefaultVideoGestures />
      <DefaultKeyboardDisplay
        icons={defaultLayoutIcons.KeyboardDisplay ?? {}}
      />
      <GoogleCastErrorListener />
      <DefaultVideoLayout
        disableTimeSlider
        icons={defaultLayoutIcons}
        slots={{
          ...liveControlSlots,
          ...channelControls,
          smallLayout: {
            ...liveControlSlots,
            ...channelControls,
          },
        }}
        smallLayoutWhen={false}
      />
    </>
  );
}

function LiveChannelMeta() {
  const live = useMediaState("live");
  const title = useMediaState("title");

  if (!live) {
    return null;
  }

  return (
    <div className="vds-live-channel-meta flex min-w-0 items-center gap-2.5">
      <LiveButton
        className="vds-live-button shrink-0"
        aria-label="Skip to live"
      >
        <span className="vds-live-button-text">LIVE</span>
      </LiveButton>
      {title ? (
        <Title className="vds-chapter-title min-w-0 max-w-[min(48vw,480px)] truncate font-semibold" />
      ) : null}
    </div>
  );
}
