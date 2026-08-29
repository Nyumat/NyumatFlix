"use client";

import { cn } from "@/lib/utils";

export type SearchContentFilter = "all" | "movie" | "tv" | "person";

const TABS: Array<{ value: SearchContentFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "person", label: "People" },
];

type SearchTypeTabsProps = {
  value: SearchContentFilter;
  onChange: (value: SearchContentFilter) => void;
  className?: string;
  size?: "sm" | "md";
};

export function SearchTypeTabs({
  value,
  onChange,
  className,
  size = "sm",
}: SearchTypeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter search results"
      className={cn(
        "inline-flex gap-0.5 rounded-md border border-white/10 bg-white/[0.03] p-0.5",
        className,
      )}
      data-testid="search-type-tabs"
    >
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "rounded-sm font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === tab.value
              ? "bg-white/10 text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
          )}
          data-testid={`search-type-tab-${tab.value}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
