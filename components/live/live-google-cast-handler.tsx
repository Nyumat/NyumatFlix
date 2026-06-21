"use client";

import {
  GoogleCastButton,
  Tooltip,
  useMediaPlayer,
  useMediaState,
} from "@vidstack/react";
import { ChromecastIcon } from "@vidstack/react/icons";
import { useEffect } from "react";
import { toast } from "sonner";

type GoogleCastPromptErrorDetail = Error & {
  code?: string;
};

const CAST_ERROR_MESSAGES: Record<string, string> = {
  CAST_NOT_AVAILABLE: "Google Cast is not available on this device.",
  CANCEL: "Google Cast was cancelled.",
  TIMEOUT: "Google Cast timed out. Try again.",
  API_NOT_INITIALIZED: "Google Cast could not start. Try again.",
  EXTENSION_NOT_COMPATIBLE: "Your Google Cast extension is not compatible.",
  EXTENSION_MISSING: "Install the Google Cast extension to cast.",
  RECEIVER_UNAVAILABLE: "No Cast receiver is available.",
  SESSION_ERROR: "Google Cast session failed.",
  CHANNEL_ERROR: "Google Cast connection failed.",
  NO_DEVICES_AVAILABLE: "No Cast devices found.",
  LOAD_MEDIA_FAILED: "This stream could not be cast.",
};

const formatGoogleCastError = (error: GoogleCastPromptErrorDetail) => {
  if (error.code && CAST_ERROR_MESSAGES[error.code]) {
    return CAST_ERROR_MESSAGES[error.code];
  }

  return error.message || "Google Cast failed.";
};

export function GoogleCastErrorListener() {
  const player = useMediaPlayer();

  useEffect(() => {
    if (!player) {
      return undefined;
    }

    const onPromptError = (event: Event) => {
      const detail = (event as CustomEvent<GoogleCastPromptErrorDetail>).detail;

      if (!detail) {
        toast.error("Google Cast failed.");
        return;
      }

      if (detail.code === "CANCEL") {
        return;
      }

      toast.error(formatGoogleCastError(detail));
    };

    player.addEventListener("google-cast-prompt-error", onPromptError);

    return () => {
      player.removeEventListener("google-cast-prompt-error", onPromptError);
    };
  }, [player]);

  return null;
}

export function LiveGoogleCastButton() {
  const canGoogleCast = useMediaState("canGoogleCast");

  if (!canGoogleCast) {
    return (
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            className="vds-google-cast-button vds-button"
            aria-label="Google Cast unavailable"
            onClick={() => {
              toast.error(CAST_ERROR_MESSAGES.CAST_NOT_AVAILABLE);
            }}
          >
            <ChromecastIcon className="vds-icon" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content className="vds-tooltip-content" placement="top">
          Google Cast
        </Tooltip.Content>
      </Tooltip.Root>
    );
  }

  return <GoogleCastButton />;
}
