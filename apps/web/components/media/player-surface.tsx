"use client";

import { forwardRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import "./player-surface.css";

type PlayerSurfaceProps = {
  children?: ReactNode;
  className?: string;
};

export const PlayerSurface = forwardRef<HTMLDivElement, PlayerSurfaceProps>(
  function PlayerSurface({ children, className }, ref) {
    return (
      <div className="nyumat-player-frame">
        <div className="nyumat-player-halo" aria-hidden />
        <div ref={ref} className={cn("nyumat-player-surface", className)}>
          {children}
        </div>
      </div>
    );
  },
);
