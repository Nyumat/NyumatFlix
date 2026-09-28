"use client";

import { Check, Radio, Share2, Tv } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLiveTvGuide } from "@/components/live/live-tv-guide-context";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import type { LiveChannel } from "@/lib/live/types";
import { cn } from "@/lib/utils";

const formatEventTime = (value: string | null) => {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
};

type LiveNowPlayingStripProps = {
  channel: LiveChannel;
  className?: string;
};

export function LiveNowPlayingStrip({
  channel,
  className,
}: LiveNowPlayingStripProps) {
  const eventTime =
    channel.kind === "event" ? formatEventTime(channel.startsAt) : null;
  const subtitle =
    channel.unavailableReason ??
    [channel.categoryName, eventTime].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-white/10 bg-black/30 px-4 py-3 md:px-5",
        className,
      )}
    >
      <ChannelLogo channel={channel} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">
            {channel.name}
          </p>
          {channel.kind === "event" ? (
            <Badge className="h-4 shrink-0 rounded border-amber-300/20 bg-amber-400/15 px-1 text-[9px] font-semibold uppercase text-amber-200">
              Event
            </Badge>
          ) : null}
        </div>
        {subtitle ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>

      <LiveStripShareButton />
    </div>
  );
}

function LiveStripShareButton() {
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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
      aria-label={copied ? "Link copied" : "Share channel"}
      onClick={handleShare}
    >
      {copied ? (
        <Check className="size-3.5 text-primary" />
      ) : (
        <Share2 className="size-3.5" />
      )}
    </Button>
  );
}

function ChannelLogo({ channel }: { channel: LiveChannel }) {
  const [failed, setFailed] = useState(false);

  if (!channel.logoUrl || failed) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-muted-foreground">
        {channel.kind === "event" ? (
          <Radio className="size-4" strokeWidth={1.8} />
        ) : (
          <Tv className="size-4" strokeWidth={1.8} />
        )}
      </div>
    );
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] p-1">
      <img
        src={channel.logoUrl}
        alt=""
        className="max-h-full max-w-full object-contain"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
