import {
  isExternalMediaHref,
  resolveMediaPeekTarget,
  type MediaPeekTarget,
} from "@/lib/peek/media-peek-target";
import { useMediaPeekStore } from "@/lib/stores/media-peek-store";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";
import { useCallback } from "react";

type ActivateEvent = MouseEvent | KeyboardEvent;

const isModifiedActivate = (event: ActivateEvent) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

export const useOpenMediaPeek = () => {
  const openPeek = useMediaPeekStore((state) => state.openPeek);
  const router = useRouter();

  return useCallback(
    (
      event: ActivateEvent,
      item: Parameters<typeof resolveMediaPeekTarget>[0],
      href: string,
    ) => {
      if ("button" in event && event.button !== 0) return;

      if (!href || isExternalMediaHref(href)) return;

      if (isModifiedActivate(event)) {
        event.preventDefault();
        router.push(href);
        return;
      }

      const target = resolveMediaPeekTarget(item, href);
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      openPeek(target);
    },
    [openPeek, router],
  );
};

export const useReplaceMediaPeek = () => {
  const openPeek = useMediaPeekStore((state) => state.openPeek);

  return useCallback(
    (target: MediaPeekTarget) => {
      openPeek(target);
    },
    [openPeek],
  );
};
