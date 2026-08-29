"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const RICK_VIDEO_ID = "dQw4w9WgXcQ";

export function DevtoolsTrollOverlay() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] bg-black">
      <iframe
        title="player"
        src={`https://www.youtube-nocookie.com/embed/${RICK_VIDEO_ID}?autoplay=1&mute=0&controls=0&loop=1&playlist=${RICK_VIDEO_ID}&rel=0&modestbranding=1`}
        className="size-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>,
    document.body,
  );
}
