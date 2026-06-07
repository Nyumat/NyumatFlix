"use client";

import {
  Captions,
  LiveButton,
  Title,
  Tooltip,
  useMediaState,
} from "@vidstack/react";
import {
  DefaultBufferingIndicator,
  DefaultKeyboardDisplay,
  DefaultVideoGestures,
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import { QueueListIcon } from "@vidstack/react/icons";

import {
  GoogleCastErrorListener,
  LiveGoogleCastButton,
} from "@/components/live/live-google-cast-handler";
import { useLiveTvGuide } from "@/components/live/live-tv-guide-context";
import { cn } from "@/lib/utils";

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
  downloadButton: <ChannelGuideButton />,
  googleCastButton: <LiveGoogleCastButton />,
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
    downloadButton: <ChannelGuideButton />,
    googleCastButton: <LiveGoogleCastButton />,
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

function ChannelGuideButton() {
  const { guideOpen, setGuideOpen } = useLiveTvGuide();

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={cn(
            "vds-button xl:hidden",
            guideOpen && "vds-button-active",
          )}
          aria-label={guideOpen ? "Close channels" : "Open channels"}
          aria-expanded={guideOpen}
          onClick={() => setGuideOpen(!guideOpen)}
        >
          <QueueListIcon className="vds-icon" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content className="vds-tooltip-content" placement="top">
        Channels
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
