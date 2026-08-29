import useMedia from "@/hooks/useMedia";
import { TV_DETAIL_LG_MEDIA_QUERY } from "@/lib/constants";

export const useTvDetailIsDesktop = (defaultState?: boolean) =>
  useMedia(TV_DETAIL_LG_MEDIA_QUERY, defaultState);
