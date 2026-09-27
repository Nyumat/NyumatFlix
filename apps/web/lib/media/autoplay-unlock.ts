"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether the user has interacted with the page (click/tap/key). Card
 * hover previews can only auto-play *with sound* after a user gesture —
 * browsers block unmuted autoplay otherwise — so the preview hook uses this to
 * decide between starting muted or unmuted.
 */

const INTERACTION_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "click",
] as const;

let userInteracted = false;
let initialized = false;
const listeners = new Set<(value: boolean) => void>();

const teardown = () => {
  if (typeof window === "undefined") return;
  for (const event of INTERACTION_EVENTS) {
    window.removeEventListener(event, markUserInteracted, { capture: true });
  }
  initialized = false;
};

function markUserInteracted() {
  if (userInteracted) return;
  userInteracted = true;
  teardown();
  for (const listener of listeners) {
    listener(true);
  }
}

export const initUserInteractionTracking = (): void => {
  if (typeof window === "undefined" || initialized || userInteracted) {
    return;
  }
  initialized = true;
  for (const event of INTERACTION_EVENTS) {
    window.addEventListener(event, markUserInteracted, {
      capture: true,
      passive: true,
    });
  }
};

export const hasUserInteracted = (): boolean => userInteracted;

export const subscribeUserInteraction = (
  listener: (value: boolean) => void,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useHasUserInteracted = (): boolean => {
  const [value, setValue] = useState(userInteracted);

  useEffect(() => {
    if (userInteracted) {
      setValue(true);
      return;
    }
    initUserInteractionTracking();
    return subscribeUserInteraction(setValue);
  }, []);

  return value;
};

export const resetUserInteractionForTests = (): void => {
  teardown();
  userInteracted = false;
  listeners.clear();
};
