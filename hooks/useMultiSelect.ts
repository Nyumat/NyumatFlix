"use client";

import { useCallback, useEffect, useState } from "react";

export interface UseMultiSelectState {
  selectedValues: string[];
  isPopoverOpen: boolean;
  isAnimating: boolean;
}

export interface UseMultiSelectActions {
  setSelectedValues: (values: string[]) => void;
  toggleOption: (value: string) => void;
  handleClear: () => void;
  handleTogglePopover: () => void;
  clearExtraOptions: (maxCount: number) => void;
  toggleAll: (allValues: string[]) => void;
  setIsAnimating: (value: boolean) => void;
  setIsPopoverOpen: (value: boolean) => void;
}

export interface UseMultiSelectReturn
  extends UseMultiSelectState,
    UseMultiSelectActions {}

export const useMultiSelect = (
  defaultValue: string[] = [],
): UseMultiSelectReturn => {
  const [selectedValues, setSelectedValues] = useState<string[]>(defaultValue);
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  useEffect(() => {
    setSelectedValues(defaultValue);
  }, [defaultValue]);

  const toggleOption = useCallback((value: string) => {
    setSelectedValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const handleClear = useCallback(() => {
    setSelectedValues([]);
  }, []);

  const handleTogglePopover = useCallback(() => {
    setIsPopoverOpen((prev) => !prev);
  }, []);

  const clearExtraOptions = useCallback((maxCount: number) => {
    setSelectedValues((prev) => prev.slice(0, maxCount));
  }, []);

  const toggleAll = useCallback((allValues: string[]) => {
    setSelectedValues((prev) =>
      prev.length === allValues.length ? [] : allValues,
    );
  }, []);

  return {
    selectedValues,
    isPopoverOpen,
    isAnimating,
    setSelectedValues,
    toggleOption,
    handleClear,
    handleTogglePopover,
    clearExtraOptions,
    toggleAll,
    setIsAnimating,
    setIsPopoverOpen,
  };
};

export type UseMultiSelect = typeof useMultiSelect;
