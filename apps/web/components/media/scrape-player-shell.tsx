"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ScrapePlayerShellProps = {
  backdropUrl?: string | null;
  blurBackdrop?: boolean;
  hideBackdrop?: boolean;
  className?: string;
  children: ReactNode;
};

export function ScrapePlayerShell({
  backdropUrl,
  blurBackdrop = false,
  hideBackdrop = false,
  className,
  children,
}: ScrapePlayerShellProps) {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-lg border border-border/20 bg-black shadow-2xl",
        className,
      )}
    >
      {backdropUrl ? (
        <Image
          src={backdropUrl}
          alt=""
          fill
          priority
          sizes="(max-width: 1280px) 100vw, 1280px"
          className={cn(
            "object-cover transition-opacity duration-500",
            hideBackdrop && "opacity-0",
            !hideBackdrop &&
              blurBackdrop &&
              "scale-[1.02] blur-sm brightness-50",
          )}
          aria-hidden
        />
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-black/50 transition-opacity duration-500",
          hideBackdrop && "opacity-0",
          !hideBackdrop && blurBackdrop && "bg-black/60",
        )}
        aria-hidden
      />

      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}
