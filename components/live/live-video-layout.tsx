"use client";

import { Captions, LiveButton, Title, useMediaState } from "@vidstack/react";
import {
  DefaultBufferingIndicator,
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

const liveLayoutSlots = {
  seekBackwardButton: null,
  seekForwardButton: null,
  chaptersMenu: null,
  chapterTitle: null,
  captionButton: controlsSpacer,
  liveButton: <LiveChannelMeta />,
  startDuration: null,
  endTime: null,
  timeSlider: null,
  downloadButton: null,
  googleCastButton: (
    <>
      <LiveShareChannelButton />
      <LiveGoogleCastButton />
    </>
  ),
  smallLayout: {
    seekBackwardButton: null,
    seekForwardButton: null,
    chaptersMenu: null,
    chapterTitle: null,
    captionButton: controlsSpacer,
    liveButton: <LiveChannelMeta />,
    startDuration: null,
    endTime: null,
    timeSlider: null,
    downloadButton: null,
    googleCastButton: (
      <>
        <LiveShareChannelButton />
        <LiveGoogleCastButton />
      </>
    ),
  },
} as const;

export function LiveVideoLayout() {
  return (
    <>
      <Captions className="vds-captions" />
      <DefaultBufferingIndicator />
      <DefaultVideoGestures />
      <DefaultKeyboardDisplay
        icons={defaultLayoutIcons.KeyboardDisplay ?? {}}
      />
      <GoogleCastErrorListener />
      <DefaultVideoLayout
        disableTimeSlider
        icons={defaultLayoutIcons}
        slots={liveLayoutSlots}
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
        <Title className="vds-chapter-title min-w-0 max-w-[min(38vw,320px)] truncate font-semibold" />
      ) : null}
    </div>
  );
}
