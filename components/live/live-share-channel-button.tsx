"use client";

import { Tooltip } from "@vidstack/react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";

import { useLiveTvGuide } from "@/components/live/live-tv-guide-context";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { cn } from "@/lib/utils";

export function LiveShareChannelButton() {
  const { shareUrl } = useLiveTvGuide();
  const { copied, copy } = useCopyToClipboard();

  if (!shareUrl) {
    return null;
  }

  const handleShare = async () => {
    const didCopy = await copy(shareUrl);

    if (didCopy) {
      toast.success("Channel link copied");
      return;
    }

    toast.error("Could not copy link");
  };

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={cn("vds-button", copied && "vds-button-active")}
          aria-label={copied ? "Link copied" : "Share channel"}
          onClick={handleShare}
        >
          {copied ? (
            <Check className="vds-icon" />
          ) : (
            <Share2 className="vds-icon" />
          )}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content className="vds-tooltip-content" placement="top">
        {copied ? "Copied" : "Share channel"}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
