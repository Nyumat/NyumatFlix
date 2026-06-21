"use client";

import {
  getSearchAutocompleteItemCount,
  getSearchAutocompleteOptionId,
  getSearchComboboxInputProps,
  resolveSearchAutocompleteSelection,
  type SearchAutocompleteFooter,
  type SearchAutocompleteSelection,
} from "@/components/search/search-autocomplete";
import type { SearchPreviewResult } from "@/lib/api";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type RefObject,
} from "react";

interface UseSearchAutocompleteOptions {
  query: string;
  results: SearchPreviewResult[];
  suggestions: string[];
  isOpen: boolean;
  footer?: SearchAutocompleteFooter;
  ariaLabel?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onSelect: (selection: SearchAutocompleteSelection) => void;
  onClose: () => void;
  onBlurInput?: () => void;
}

export function useSearchAutocomplete({
  query,
  results,
  suggestions,
  isOpen,
  footer = "none",
  ariaLabel,
  inputRef,
  onSelect,
  onClose,
  onBlurInput,
}: UseSearchAutocompleteOptions) {
  const listboxId = useId();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [focusTarget, setFocusTarget] = useState<"input" | "list">("input");
  const includeFooter = footer !== "none";

  const itemCount = getSearchAutocompleteItemCount(suggestions, results, {
    includeFooter,
  });

  const activeOptionId =
    focusTarget === "input" && selectedIndex >= 0
      ? getSearchAutocompleteOptionId(listboxId, selectedIndex)
      : undefined;

  const comboboxInputProps = useMemo(
    () =>
      getSearchComboboxInputProps({
        isOpen,
        listboxId,
        activeOptionId,
        ariaLabel,
      }),
    [activeOptionId, ariaLabel, isOpen, listboxId],
  );

  const focusOption = useCallback(
    (index: number) => {
      setFocusTarget("list");
      setSelectedIndex(index);
      requestAnimationFrame(() => {
        document
          .getElementById(getSearchAutocompleteOptionId(listboxId, index))
          ?.focus();
      });
    },
    [listboxId],
  );

  const focusInput = useCallback(() => {
    setFocusTarget("input");
    setSelectedIndex(-1);
    inputRef?.current?.focus();
  }, [inputRef]);

  useEffect(() => {
    setSelectedIndex(-1);
    setFocusTarget("input");
  }, [query, results, suggestions, footer]);

  const handleInputFocus = useCallback(() => {
    setFocusTarget("input");
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) {
        return false;
      }

      if (itemCount === 0) {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          onBlurInput?.();
          return true;
        }
        return false;
      }

      switch (event.key) {
        case "Tab":
          if (event.shiftKey) {
            return false;
          }
          event.preventDefault();
          focusOption(selectedIndex < 0 ? 0 : selectedIndex);
          return true;
        case "ArrowDown":
          event.preventDefault();
          focusOption(selectedIndex < itemCount - 1 ? selectedIndex + 1 : 0);
          return true;
        case "ArrowUp":
          event.preventDefault();
          if (selectedIndex <= 0) {
            focusInput();
          } else {
            focusOption(selectedIndex - 1);
          }
          return true;
        case "Home":
          event.preventDefault();
          focusOption(0);
          return true;
        case "End":
          event.preventDefault();
          focusOption(itemCount - 1);
          return true;
        case "Enter": {
          const selection = resolveSearchAutocompleteSelection(
            suggestions,
            results,
            selectedIndex,
            { includeFooter },
          );
          if (selection) {
            event.preventDefault();
            onSelect(selection);
            return true;
          }
          return false;
        }
        case "Escape":
          event.preventDefault();
          onClose();
          setSelectedIndex(-1);
          setFocusTarget("input");
          onBlurInput?.();
          return true;
        default:
          return false;
      }
    },
    [
      focusInput,
      focusOption,
      footer,
      includeFooter,
      isOpen,
      itemCount,
      onBlurInput,
      onClose,
      onSelect,
      results,
      selectedIndex,
      suggestions,
    ],
  );

  const handleOptionKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      if (!isOpen || itemCount === 0) {
        return;
      }

      switch (event.key) {
        case "Tab":
          if (event.shiftKey) {
            event.preventDefault();
            if (index <= 0) {
              focusInput();
            } else {
              focusOption(index - 1);
            }
            return;
          }
          if (index >= itemCount - 1) {
            setFocusTarget("input");
            setSelectedIndex(-1);
            return;
          }
          event.preventDefault();
          focusOption(index + 1);
          return;
        case "ArrowDown":
          event.preventDefault();
          focusOption(index < itemCount - 1 ? index + 1 : 0);
          return;
        case "ArrowUp":
          event.preventDefault();
          if (index <= 0) {
            focusInput();
          } else {
            focusOption(index - 1);
          }
          return;
        case "Home":
          event.preventDefault();
          focusOption(0);
          return;
        case "End":
          event.preventDefault();
          focusOption(itemCount - 1);
          return;
        case "Enter":
        case " ": {
          event.preventDefault();
          const selection = resolveSearchAutocompleteSelection(
            suggestions,
            results,
            index,
            { includeFooter },
          );
          if (selection) {
            onSelect(selection);
          }
          return;
        }
        case "Escape":
          event.preventDefault();
          onClose();
          setSelectedIndex(-1);
          setFocusTarget("input");
          onBlurInput?.();
          return;
        default:
          return;
      }
    },
    [
      focusInput,
      focusOption,
      includeFooter,
      isOpen,
      itemCount,
      onBlurInput,
      onClose,
      onSelect,
      results,
      suggestions,
    ],
  );

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    handleOptionKeyDown,
    handleInputFocus,
    focusOption,
    itemCount,
    listboxId,
    comboboxInputProps,
  };
}

export function shouldKeepSearchFocusWithinContainer(
  event: React.FocusEvent,
  container: HTMLElement | null,
): boolean {
  const nextTarget = event.relatedTarget;
  return nextTarget instanceof Node && Boolean(container?.contains(nextTarget));
}
