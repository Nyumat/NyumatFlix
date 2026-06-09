import { truncateDescription } from "./metadata";

/** Taglines longer than this are treated as too long — use overview instead. */
export const PREFERRED_SHORT_DESC_MAX = 120;

/** Taglines shorter than this are too terse — use overview instead. */
export const PREFERRED_SHORT_DESC_MIN = 15;

type BuildMediaDescriptionOptions = {
  tagline?: string | null;
  overview?: string | null;
  fallback: string;
  maxLength?: number;
};

const normalize = (value?: string | null) => value?.trim() || "";

export const buildMediaDescription = ({
  tagline,
  overview,
  fallback,
  maxLength = 160,
}: BuildMediaDescriptionOptions): string => {
  const shortText = normalize(tagline);
  const longText = normalize(overview);
  const isUsefulShort =
    shortText.length >= PREFERRED_SHORT_DESC_MIN &&
    shortText.length <= PREFERRED_SHORT_DESC_MAX;

  if (isUsefulShort) {
    return truncateDescription(shortText, maxLength);
  }

  if (longText) {
    return truncateDescription(longText, maxLength);
  }

  if (shortText) {
    return truncateDescription(shortText, maxLength);
  }

  return truncateDescription(fallback, maxLength);
};
