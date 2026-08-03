"use client";

import { Button } from "@/components/ui/button";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
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
import { useEffect, useState } from "react";

const ICONS: Record<string, LucideIcon> = {
  Bell,
  Film,
  Info,
  Megaphone,
  PartyPopper,
  Sparkles,
  TriangleAlert,
};

interface AnniversaryBannerProps {
  className?: string;
}

export function AnniversaryBanner({ className }: AnniversaryBannerProps) {
  const { announcementBanner } = useFeatureFlags();
  const [isVisible, setIsVisible] = useState(false);
  const [hasCheckedDismissal, setHasCheckedDismissal] = useState(false);
  const storageKey = `nyumatflix-announcement-banner-${announcementBanner.id}`;
  const Icon = ICONS[announcementBanner.icon] ?? Megaphone;

  useEffect(() => {
    const wasDismissed = window.localStorage.getItem(storageKey) === "closed";

    setIsVisible(announcementBanner.enabled && !wasDismissed);
    setHasCheckedDismissal(true);
  }, [announcementBanner.enabled, storageKey]);

  const closeBanner = () => {
    window.localStorage.setItem(storageKey, "closed");
    setIsVisible(false);
  };

  const hasLink = Boolean(
    announcementBanner.linkLabel && announcementBanner.linkUrl,
  );
  const linkClassName =
    "inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-current/20 transition hover:brightness-110 sm:text-sm";
  const linkContent = (
    <>
      <span>{announcementBanner.linkLabel}</span>
      <ChevronRight className="size-3.5" strokeWidth={2.5} />
    </>
  );

  return (
    <AnimatePresence initial={false}>
      {hasCheckedDismissal && isVisible && (
        <motion.div
          className={cn(
            "overflow-hidden border-b border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.24)]",
            className,
          )}
          style={{
            backgroundColor: announcementBanner.backgroundColor,
            color: announcementBanner.textColor,
          }}
          initial={{ height: 0, opacity: 0, y: -12 }}
          animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: "easeInOut" }}
        >
          <div className="site-container grid min-h-11 grid-cols-[2.5rem_1fr_2.5rem] items-center">
            <span aria-hidden />
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-sm leading-snug sm:text-base">
              <Icon className="size-4 shrink-0" aria-hidden />
              {announcementBanner.title ? (
                <strong className="font-bold">
                  {announcementBanner.title}
                </strong>
              ) : null}
              {announcementBanner.message ? (
                <span className="font-medium opacity-85">
                  {announcementBanner.message}
                </span>
              ) : null}
              {hasLink && announcementBanner.linkUrl.startsWith("/") ? (
                <Link
                  href={announcementBanner.linkUrl}
                  className={linkClassName}
                  style={{
                    backgroundColor: announcementBanner.accentColor,
                    color: announcementBanner.backgroundColor,
                  }}
                >
                  {linkContent}
                </Link>
              ) : hasLink ? (
                <a
                  href={announcementBanner.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClassName}
                  style={{
                    backgroundColor: announcementBanner.accentColor,
                    color: announcementBanner.backgroundColor,
                  }}
                >
                  {linkContent}
                </a>
              ) : null}
            </div>
            {announcementBanner.dismissible ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 justify-self-end rounded-full text-current hover:bg-white/10 hover:text-current"
                aria-label="Close announcement banner"
                onClick={closeBanner}
              >
                <X className="size-4" strokeWidth={2} />
              </Button>
            ) : (
              <span aria-hidden />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
