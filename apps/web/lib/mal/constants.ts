import type { MalMyListStatus } from "./types";

export type MalListStatus = NonNullable<MalMyListStatus["status"]>;

export const MAL_LIST_STATUS_OPTIONS: Array<{
  value: MalListStatus;
  label: string;
}> = [
  { value: "watching", label: "Watching" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On-Hold" },
  { value: "dropped", label: "Dropped" },
  { value: "plan_to_watch", label: "Plan to Watch" },
];

export const MAL_SCORE_OPTIONS: Array<{
  value: number;
  label: string;
}> = [
  { value: 0, label: "—" },
  { value: 1, label: "(1) Appalling" },
  { value: 2, label: "(2) Horrible" },
  { value: 3, label: "(3) Very Bad" },
  { value: 4, label: "(4) Bad" },
  { value: 5, label: "(5) Average" },
  { value: 6, label: "(6) Fine" },
  { value: 7, label: "(7) Good" },
  { value: 8, label: "(8) Very Good" },
  { value: 9, label: "(9) Great" },
  { value: 10, label: "(10) Masterpiece" },
];

export const malListStatusLabel = (status: MalListStatus | undefined): string =>
  MAL_LIST_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
  "Watching";

export const malScoreLabel = (score: number | undefined | null): string => {
  if (typeof score !== "number" || score <= 0) {
    return MAL_SCORE_OPTIONS[0]!.label;
  }
  return (
    MAL_SCORE_OPTIONS.find((option) => option.value === score)?.label ??
    `(${score})`
  );
};

/** MAL-style episode total label: known count or "-" when airing/unknown. */
export const formatMalEpisodeTotal = (
  totalEpisodes: number | null | undefined,
): string =>
  typeof totalEpisodes === "number" && totalEpisodes > 0
    ? String(totalEpisodes)
    : "-";
