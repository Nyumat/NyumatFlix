"use client";

import { MediaItem } from "@/utils/typings";
import {
  StandardContentRow,
  StandardContentRowProps,
} from "./standard-content-row";
import { RankedContentRow, RankedContentRowProps } from "./ranked-content-row";

export type ContentRowVariant = "standard" | "ranked";

// The main ContentRowProps interface now includes the variant
export interface ContentRowProps<T extends MediaItem> {
  title: string;
  items: T[];
  href: string;
  variant?: ContentRowVariant;
  contentRating?: Record<number, string | null>;
  onLoadMore?: () => Promise<T[]>;
  hasMoreItems?: boolean;
}

// This component now acts as a dispatcher
export function ContentRow<T extends MediaItem>(props: ContentRowProps<T>) {
  const { variant = "standard", ...restProps } = props;

  if (variant === "ranked") {
    // Pass RankedContentRowProps, ensure type compatibility
    return <RankedContentRow {...(restProps as RankedContentRowProps<T>)} />;
  }

  // Pass StandardContentRowProps, ensure type compatibility
  return <StandardContentRow {...(restProps as StandardContentRowProps<T>)} />;
}
