"use client";

import { cn } from "@/lib/utils";
import { Children, type ReactNode } from "react";

type MediaPeekMarqueeProps = {
  children: ReactNode;
  durationSeconds?: number;
  className?: string;
};

export const MediaPeekMarquee = ({
  children,
  durationSeconds = 42,
  className,
}: MediaPeekMarqueeProps) => {
  const items = Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;

  const track = (
    <>
      {items}
      {items}
    </>
  );

  return (
    <div
      className={cn("group/peek-marquee relative overflow-hidden", className)}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r from-background via-background/80 to-transparent sm:w-16"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-background via-background/80 to-transparent sm:w-16"
        aria-hidden
      />
      <div
        className="flex w-max gap-3 motion-safe:animate-peek-marquee motion-safe:group-hover/peek-marquee:[animation-play-state:paused] sm:gap-4"
        style={
          {
            "--peek-marquee-duration": `${durationSeconds}s`,
          } as React.CSSProperties
        }
      >
        {track}
      </div>
    </div>
  );
};
