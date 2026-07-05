"use client";

import { useEffect, type RefObject } from "react";

type UseSearchKeyboardShortcutsOptions = {
  inputRef: RefObject<HTMLInputElement | null>;
  enabled?: boolean;
  focusOnPrintable?: boolean;
  focusOnSlash?: boolean;
  focusOnModK?: boolean;
  onEscape?: () => void;
};

export function useSearchKeyboardShortcuts({
  inputRef,
  enabled = true,
  focusOnPrintable = false,
  focusOnSlash = false,
  focusOnModK = true,
  onEscape,
}: UseSearchKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) {
        return;
      }
      const isTypingInInput =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable;

      if (focusOnSlash && event.key === "/" && !isTypingInInput) {
        event.preventDefault();
        inputRef.current?.focus();
      }

      if (event.key === "Escape") {
        onEscape?.();
        inputRef.current?.blur();
      }

      if (
        focusOnPrintable &&
        !isTypingInInput &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        inputRef.current !== document.activeElement
      ) {
        inputRef.current?.focus();
      }

      if (
        focusOnModK &&
        event.key === "k" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    const target = focusOnModK ? document : window;
    target.addEventListener("keydown", handleKeyDown);
    return () => target.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    focusOnModK,
    focusOnPrintable,
    focusOnSlash,
    inputRef,
    onEscape,
  ]);
}
