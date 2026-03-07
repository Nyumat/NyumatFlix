"use client";

export type ViewMode = "grid" | "canvas";
export type TimelineMode = "episodes" | "seasons";

export type RatingCategory =
  | "awesome"
  | "great"
  | "good"
  | "regular"
  | "bad"
  | "garbage";

export type EpisodeRating = {
  seasonNumber: number;
  episodeNumber: number;
  rating: number;
  name: string;
  id: number;
};

export type SeasonRatings = {
  seasonNumber: number;
  seasonName: string;
  episodes: EpisodeRating[];
  average: number;
};

export const RATING_COLORS: Record<RatingCategory, string> = {
  awesome: "rgb(24, 106, 59)",
  great: "rgb(40, 180, 99)",
  good: "rgb(244, 208, 63)",
  regular: "rgb(243, 156, 18)",
  bad: "rgb(231, 76, 60)",
  garbage: "rgb(99, 57, 116)",
};

export const RATING_CATEGORIES: { key: RatingCategory; label: string }[] = [
  { key: "awesome", label: "Awesome" },
  { key: "great", label: "Great" },
  { key: "good", label: "Good" },
  { key: "regular", label: "Regular" },
  { key: "bad", label: "Bad" },
  { key: "garbage", label: "Garbage" },
];

export function getRatingCategory(rating: number): RatingCategory {
  if (rating >= 9) return "awesome";
  if (rating >= 8) return "great";
  if (rating >= 7) return "good";
  if (rating >= 6) return "regular";
  if (rating >= 5) return "bad";
  return "garbage";
}

export function getRatingColor(rating: number): string {
  return RATING_COLORS[getRatingCategory(rating)];
}

export function getTextColorForBackground(rating: number): string {
  const category = getRatingCategory(rating);
  if (category === "awesome" || category === "garbage" || category === "bad") {
    return "#ffffff";
  }
  return "#2a2a2a";
}
