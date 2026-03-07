"use client";

import { RATING_CATEGORIES, RATING_COLORS } from "./types";

export function RatingLegend() {
  return (
    <div className="flex flex-wrap gap-3 sm:gap-4">
      {RATING_CATEGORIES.map(({ key, label }) => (
        <div
          key={key}
          className="flex items-center gap-1.5"
          style={{ cursor: "default" }}
        >
          <span
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: RATING_COLORS[key] }}
          />
          <span className="text-xs sm:text-sm text-muted-foreground">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
