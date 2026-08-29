"use client";

import { AnnouncementBannerSurface } from "@/components/layout/announcement-banner-surface";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

interface AnniversaryBannerProps {
  className?: string;
}

export function AnniversaryBanner({ className }: AnniversaryBannerProps) {
  const { announcementBanner } = useFeatureFlags();
  const [isVisible, setIsVisible] = useState(false);
  const [hasCheckedDismissal, setHasCheckedDismissal] = useState(false);
  const storageKey = `nyumatflix-announcement-banner-${announcementBanner.id}`;

  useEffect(() => {
    const wasDismissed = window.localStorage.getItem(storageKey) === "closed";

    setIsVisible(announcementBanner.enabled && !wasDismissed);
    setHasCheckedDismissal(true);
  }, [announcementBanner.enabled, storageKey]);

  const closeBanner = () => {
    window.localStorage.setItem(storageKey, "closed");
    setIsVisible(false);
  };

  return (
    <AnimatePresence initial={false}>
      {hasCheckedDismissal && isVisible && (
        <motion.div
          className={cn("overflow-hidden", className)}
          initial={{ height: 0, opacity: 0, y: -12 }}
          animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: "easeInOut" }}
        >
          <AnnouncementBannerSurface
            config={announcementBanner}
            onClose={closeBanner}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
