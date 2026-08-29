"use client";

import { useEffect } from "react";

/**
 * Performs a full browser navigation to the dev magic link. A real
 * navigation (not a router transition) is required so the auth callback's
 * 302 redirect is followed by the browser and the URL bar ends up on the
 * final destination with a fresh, authenticated server render.
 */
export function DevMagicLinkRedirect({ devLink }: { devLink: string }) {
  useEffect(() => {
    let target: URL;
    try {
      target = new URL(devLink, window.location.origin);
    } catch {
      return;
    }
    if (target.origin !== window.location.origin) {
      return;
    }
    window.location.replace(target.href);
  }, [devLink]);

  return null;
}
