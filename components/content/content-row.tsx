"use client";

import dynamic from "next/dynamic";
import useMedia from "@/hooks/useMedia";
import { MediaItem } from "@/utils/typings";
import type { RankedContentRowProps } from "./ranked-content-row";
import type { StandardContentRowProps } from "./standard-content-row";
import type { VirtualizedContentRowProps } from "./virtualized-content-row";

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

const LoadingRow = () => (
  <div className="mx-4 md:mx-8 mb-8">
    <div className="h-[320px] w-full animate-pulse rounded-md bg-muted/20" />
  </div>
);

const StandardContentRow = dynamic(
  () => import("./standard-content-row").then((m) => m.StandardContentRow),
  { ssr: false, loading: LoadingRow },
);

const RankedContentRow = dynamic(
  () => import("./ranked-content-row").then((m) => m.RankedContentRow),
  { ssr: false, loading: LoadingRow },
);

const VirtualizedContentRow = dynamic(
  () =>
    import("./virtualized-content-row").then((m) => m.VirtualizedContentRow),
  { ssr: false, loading: LoadingRow },
);

/**
 * ContentRow is a component that displays a list of media items.
 * It can be either a standard or ranked list, depending on the variant prop.
 * @param props - The props for the ContentRow component.
 * @returns The ContentRow component.
 */
export function ContentRow(props: ContentRowProps) {
  const { variant = "standard", ...restProps } = props;
  const isDesktop = useMedia("(min-width: 768px)", false);
  const shouldVirtualize =
    variant === "standard" && isDesktop && (props.items?.length ?? 0) >= 24;

  const standardProps: StandardContentRowProps = restProps;
  const rankedProps: RankedContentRowProps = restProps;
  const virtualizedProps: VirtualizedContentRowProps = restProps;

  if (variant === "ranked") {
    return <RankedContentRow {...rankedProps} />;
  }

  if (shouldVirtualize) {
    return <VirtualizedContentRow {...virtualizedProps} />;
  }

  return <StandardContentRow {...standardProps} />;
}
