"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

  const [optimisticValue, setOptimisticValue] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticValue(null);
  }, [value]);

  const effectiveValue = optimisticValue ?? value;

  const selection = useMemo(() => {
    if (!effectiveValue) return [];
    return effectiveValue
      .split(separator)
      .map((part) => Number.parseInt(part, 10))
      .filter((n) => !Number.isNaN(n));
  }, [separator, effectiveValue]);

  const toggleSelection = useCallback(
    (id: number) => {
      const set = new Set(selection);
      if (set.has(id)) {
        set.delete(id);
      } else {
        set.add(id);
      }
      const next = Array.from(set);
      const nextStr = next.length ? next.join(separator) : "";
      setOptimisticValue(nextStr);
      onChange(nextStr);
    },
    [onChange, selection, separator],
  );

  const clearSelection = useCallback(() => {
    setOptimisticValue("");
    onChange("");
  }, [onChange]);

  return { selection, toggleSelection, clearSelection };
};
