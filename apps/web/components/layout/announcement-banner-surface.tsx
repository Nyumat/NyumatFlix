import { Button } from "@/components/ui/button";
import type { AnnouncementBannerConfig } from "@/lib/flags/announcement-banner";
import { cn } from "@/lib/utils";
import {
  Bell,
  ChevronRight,
  Film,
  Info,
  Megaphone,
  PartyPopper,
  Sparkles,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

const ICONS: Record<string, LucideIcon> = {
  Bell,
  Film,
  Info,
  Megaphone,
  PartyPopper,
  Sparkles,
  TriangleAlert,
};

type Props = {
  config: AnnouncementBannerConfig;
  onClose?: () => void;
  preview?: boolean;
  className?: string;
};

function BannerDot() {
  return (
    <span
      aria-hidden
      className="hidden size-1.5 shrink-0 rounded-full bg-current opacity-40 sm:block"
    />
  );
}

export function AnnouncementBannerSurface({
  config,
  onClose,
  preview = false,
  className,
}: Props) {
  const Icon = config.icon ? (ICONS[config.icon] ?? Megaphone) : null;
  const hasLink = Boolean(config.linkLabel && config.linkUrl);
  const hasTitle = Boolean(config.title);
  const hasMessage = Boolean(config.message);
  const hasContent = hasTitle || hasMessage;
  const linkClassName =
    "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-current/20 transition hover:brightness-110 sm:text-sm";
  const linkStyle = {
    backgroundColor: config.accentColor,
    color: config.backgroundColor,
  };
  const linkContent = (
    <>
      <span>{config.linkLabel}</span>
      <ChevronRight className="size-3.5" strokeWidth={2.5} aria-hidden />
    </>
  );

  const linkNode = !hasLink ? null : preview ? (
    <span className={linkClassName} style={linkStyle}>
      {linkContent}
    </span>
  ) : config.linkUrl.startsWith("/") ? (
    <Link href={config.linkUrl} className={linkClassName} style={linkStyle}>
      {linkContent}
    </Link>
  ) : (
    <a
      href={config.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClassName}
      style={linkStyle}
    >
      {linkContent}
    </a>
  );

  return (
    <div
      className={cn(
        "border-b border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.24)]",
        className,
      )}
      style={{
        backgroundColor: config.backgroundColor,
        color: config.textColor,
      }}
    >
      <div className="site-container grid min-h-11 grid-cols-[2.5rem_1fr_2.5rem] items-center">
        <span aria-hidden />
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-sm font-semibold leading-snug sm:text-base">
          {Icon ? (
            <Icon
              className="size-4 shrink-0 rotate-6"
              strokeWidth={2}
              aria-hidden
            />
          ) : null}
          {hasTitle ? (
            <strong className="font-bold">{config.title}</strong>
          ) : null}
          {hasTitle && hasMessage ? <BannerDot /> : null}
          {hasMessage ? (
            <span className="font-medium opacity-85">{config.message}</span>
          ) : null}
          {!hasContent && preview ? (
            <span className="font-semibold opacity-55">
              Your announcement will appear here
            </span>
          ) : null}
          {hasContent && hasLink ? <BannerDot /> : null}
          {linkNode}
        </div>
        {config.dismissible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 justify-self-end rounded-full text-current hover:bg-white/10 hover:text-current"
            aria-label={
              preview ? "Dismiss preview" : "Close announcement banner"
            }
            onClick={onClose}
            disabled={preview}
          >
            <X className="size-4" strokeWidth={2} />
          </Button>
        ) : (
          <span aria-hidden />
        )}
      </div>
    </div>
  );
}
