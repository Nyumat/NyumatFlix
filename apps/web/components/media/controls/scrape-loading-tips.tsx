"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import {
  SCRAPE_LOADING_TIP_INTERVAL_MS,
  SCRAPE_LOADING_TIPS,
  type ScrapeLoadingTip,
} from "@/lib/scrape/scrape-loading-tips";
import { cn } from "@/lib/utils";
import Link from "next/link";

function tipKey(tip: ScrapeLoadingTip): string {
  return typeof tip === "string" ? tip : tip.text;
}

function TipContent({ tip }: { tip: ScrapeLoadingTip }) {
  if (typeof tip === "string") {
    return <span className="block w-full">{tip}</span>;
  }

  return (
    <Link
      href={tip.href}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full underline text-white/45 hover:text-white/75 underline-offset-2"
    >
      {tip.text}
    </Link>
  );
}

export function ScrapeLoadingTips({ className }: { className?: string }) {
  const [tipIndex, setTipIndex] = useState(0);
  const tip = SCRAPE_LOADING_TIPS[tipIndex] ?? SCRAPE_LOADING_TIPS[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTipIndex((current) => (current + 1) % SCRAPE_LOADING_TIPS.length);
    }, SCRAPE_LOADING_TIP_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className={cn(
        "mt-8 flex min-h-14 w-full flex-col items-center justify-center text-center",
        className,
      )}
    >
      <p className="mb-2 text-[10px] font-semibold text-white/30">tip</p>
      <div className="relative w-full">
        <AnimatePresence mode="wait">
          <motion.p
            key={tipKey(tip)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="w-full text-sm leading-snug text-white/45"
          >
            <TipContent tip={tip} />
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
