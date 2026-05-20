"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const ANNOUNCEMENT_BANNER_STORAGE_KEY = "nyumatflix-announcement-banner-v1";

interface AnniversaryBannerProps {
  className?: string;
}

export function AnniversaryBanner({ className }: AnniversaryBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasCheckedDismissal, setHasCheckedDismissal] = useState(false);

  useEffect(() => {
    const wasDismissed =
      window.localStorage.getItem(ANNOUNCEMENT_BANNER_STORAGE_KEY) === "closed";

    setIsVisible(!wasDismissed);
    setHasCheckedDismissal(true);
  }, []);

  const closeBanner = () => {
    window.localStorage.setItem(ANNOUNCEMENT_BANNER_STORAGE_KEY, "closed");
    setIsVisible(false);
  };

  return (
    <AnimatePresence initial={false}>
      {hasCheckedDismissal && isVisible && (
        <motion.div
          className={cn(
            "overflow-hidden border-b border-zinc-800/80 bg-zinc-950/90 text-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-xl",
            className,
          )}
          initial={{ height: 0, opacity: 0, y: -12 }}
          animate={{ height: "auto", opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: "easeInOut" }}
        >
          <div className="mx-auto grid min-h-11 max-w-[1400px] grid-cols-[2.5rem_1fr_2.5rem] items-center px-3 sm:px-6 lg:px-8">
            <span aria-hidden />
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-sm font-semibold leading-snug text-zinc-100 sm:text-base">
              <span className="text-zinc-200">NyumatFlix turned 5</span>
              <span
                aria-hidden
                className="hidden h-1.5 w-1.5 rounded-full bg-zinc-500 sm:block"
              />
              <Link
                href="/anime"
                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-950 ring-1 ring-zinc-300/70 transition hover:bg-white hover:text-black sm:text-sm"
              >
                <span>Anime LTS has arrived</span>
                <ChevronRight className="size-3.5" strokeWidth={2.5} />
              </Link>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 justify-self-end rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white"
              aria-label="Close anniversary banner"
              onClick={closeBanner}
            >
              <X className="size-4" strokeWidth={2} />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
