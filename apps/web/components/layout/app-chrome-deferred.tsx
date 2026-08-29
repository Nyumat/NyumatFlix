"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const GlobalCommandMenu = dynamic(
  () =>
    import("@/components/command-menu/global-command-menu").then(
      (module) => module.GlobalCommandMenu,
    ),
  { ssr: false },
);

const MediaPeekSheet = dynamic(
  () =>
    import("@/components/peek/media-peek-sheet").then(
      (module) => module.MediaPeekSheet,
    ),
  { ssr: false },
);

const prefetchDeferredChrome = () => {
  void import("@/components/command-menu/global-command-menu");
  void import("@/components/peek/media-peek-sheet");
};

export function AppChromeDeferred() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idleCallback =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback
        : (callback: IdleRequestCallback) =>
            window.setTimeout(
              () => callback({ didTimeout: false, timeRemaining: () => 0 }),
              1,
            );

    const handleIntent = () => {
      prefetchDeferredChrome();
      setReady(true);
    };

    const idleId = idleCallback(() => {
      setReady(true);
    });

    window.addEventListener("pointerdown", handleIntent, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", handleIntent, { once: true });

    return () => {
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
      window.removeEventListener("pointerdown", handleIntent);
      window.removeEventListener("keydown", handleIntent);
    };
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <>
      <GlobalCommandMenu />
      <MediaPeekSheet />
    </>
  );
}
