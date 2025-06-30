"use client";

import { MediaItem } from "@/utils/typings";
import { RankedContentRow, RankedContentRowProps } from "./ranked-content-row";
import {
  StandardContentRow,
  StandardContentRowProps,
} from "./standard-content-row";

export type ContentRowVariant = "standard" | "ranked";
export interface ContentRowProps {
  title: string;
  items: MediaItem[];
  href: string;
  variant?: ContentRowVariant;
  contentRating?: Record<number, string | null>;
  onLoadMore?: () => Promise<MediaItem[]>;
  hasMoreItems?: boolean;
}

/**
 * ContentRow is a component that displays a list of media items.
 * It can be either a standard or ranked list, depending on the variant prop.
 * @param props - The props for the ContentRow component.
 * @returns The ContentRow component.
 */
export function ContentRow(props: ContentRowProps) {
  const { variant = "standard", ...restProps } = props;

  if (variant === "ranked") {
    return <RankedContentRow {...(restProps as RankedContentRowProps)} />;
  }

  return <StandardContentRow {...(restProps as StandardContentRowProps)} />;
}
