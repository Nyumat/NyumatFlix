"use client";

import { cn } from "@/lib/utils";

interface SearchGenreChipsProps {
  options: Array<{ label: string; value: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

export function SearchGenreChips({
  options,
  selectedIds,
  onChange,
  className,
}: SearchGenreChipsProps) {
  const hasSelection = selectedIds.length > 0;

  const handleToggle = (value: string) => {
    if (selectedIds.includes(value)) {
      onChange(selectedIds.filter((id) => id !== value));
      return;
    }
    onChange([...selectedIds, value]);
  };

  return (
    <div className={cn("space-y-2.5", className)} data-testid="genre-filter">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Genres
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(options.map((option) => option.value))}
            className="rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
          >
            All
          </button>
          {hasSelection ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Filter by genre"
        data-testid="genre-chip-list"
      >
        {options.map((option) => {
          const isSelected = selectedIds.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleToggle(option.value)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                isSelected
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-white/8 bg-white/[0.03] text-muted-foreground hover:border-white/15 hover:bg-white/[0.06] hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
