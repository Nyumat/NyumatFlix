"use client";

import { useCallback, useMemo } from "react";

type DiscoverMultiLogic = "and" | "or";

export const useDiscoverMultiSelect = ({
  value,
  logic,
  onChange,
}: {
  value: string;
  logic: DiscoverMultiLogic;
  onChange: (value: string) => void;
}) => {
  const separator = logic === "and" ? "," : "|";

  const selection = useMemo(() => {
    if (!value) return [];
    return value
      .split(separator)
      .map((part) => Number.parseInt(part, 10))
      .filter((n) => !Number.isNaN(n));
  }, [separator, value]);

  const toggleSelection = useCallback(
    (id: number) => {
      const set = new Set(selection);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      const next = Array.from(set);
      onChange(next.length ? next.join(separator) : "");
    },
    [onChange, selection, separator],
  );

  const clearSelection = useCallback(() => {
    onChange("");
  }, [onChange]);

  return { selection, toggleSelection, clearSelection };
};
