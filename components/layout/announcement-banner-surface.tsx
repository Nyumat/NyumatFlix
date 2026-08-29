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

export function AnnouncementBannerSurface({
  config,
  onClose,
  preview = false,
  className,
}: Props) {
  const Icon = ICONS[config.icon] ?? Megaphone;
  const hasLink = Boolean(config.linkLabel && config.linkUrl);
  const hasContent = Boolean(config.title || config.message);
  const actionClassName =
    "col-span-2 col-start-2 row-start-2 mt-1 inline-flex min-h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold shadow-[0_4px_14px_rgba(0,0,0,0.16)] transition hover:-translate-y-px hover:brightness-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/70 sm:col-auto sm:row-auto sm:mt-0 sm:w-auto sm:text-sm";
  const actionContent = (
    <>
      <span>{config.linkLabel || "Action"}</span>
      <ChevronRight className="size-3.5" strokeWidth={2.5} aria-hidden />
    </>
  );

  return (
    <div className={cn("w-full px-3 pt-3 sm:px-4", className)}>
      <div
        className="mx-auto grid min-h-16 w-full max-w-5xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-2xl border border-white/15 px-3 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.28)] sm:flex sm:gap-4 sm:px-4"
        style={{
          backgroundColor: config.backgroundColor,
          color: config.textColor,
        }}
      >
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-current/15 sm:size-10"
          style={{ backgroundColor: `${config.accentColor}1f` }}
        >
          <Icon className="size-4.5 sm:size-5" strokeWidth={2} aria-hidden />
        </div>

        <div className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {config.title ? (
              <strong className="text-sm font-bold leading-snug sm:text-base">
                {config.title}
              </strong>
            ) : null}
            {config.message ? (
              <span className="text-xs font-medium leading-snug opacity-75 sm:text-sm">
                {config.message}
              </span>
            ) : null}
            {!hasContent && preview ? (
              <span className="text-sm font-semibold opacity-55">
                Your announcement will appear here
              </span>
            ) : null}
          </div>
        </div>

        {hasLink && !preview ? (
          config.linkUrl.startsWith("/") ? (
            <Link
              href={config.linkUrl}
              className={actionClassName}
              style={{
                backgroundColor: config.accentColor,
                color: config.backgroundColor,
              }}
            >
              {actionContent}
            </Link>
          ) : (
            <a
              href={config.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={actionClassName}
              style={{
                backgroundColor: config.accentColor,
                color: config.backgroundColor,
              }}
            >
              {actionContent}
            </a>
          )
        ) : hasLink || (preview && config.linkLabel) ? (
          <span
            className={actionClassName}
            style={{
              backgroundColor: config.accentColor,
              color: config.backgroundColor,
            }}
          >
            {actionContent}
          </span>
        ) : null}

        {config.dismissible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="col-start-3 row-start-1 size-9 shrink-0 rounded-xl text-current hover:bg-white/10 hover:text-current sm:col-auto sm:row-auto"
            aria-label={
              preview ? "Dismiss preview" : "Close announcement banner"
            }
            onClick={onClose}
            disabled={preview}
          >
            <X className="size-4" strokeWidth={2} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
