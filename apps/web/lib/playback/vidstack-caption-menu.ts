export type VidstackCaptionMenuTrack = {
  id: string;
  kind: string;
  label: string;
};

/** Matches Vidstack `useCaptionOptions` radio `value` / React menu keys. */
export const vidstackCaptionMenuValue = (
  track: VidstackCaptionMenuTrack,
): string => `${track.id}:${track.kind}-${track.label.toLowerCase()}`;
