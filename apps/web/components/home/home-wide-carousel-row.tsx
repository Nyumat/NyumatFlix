"use client";

import {
  CatalogHubRow,
  CatalogHubRowToolbar,
} from "@/components/catalog/catalog-hub-row";
import {
  carouselItemClassName,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { wideCarouselItemClassName } from "@/lib/carousel-layout";
import { contentRowActionLinkClassName } from "@/lib/content-row-action-link";
import { CarouselItem } from "@/components/ui/carousel";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

export const homeWideCarouselItemClassName = wideCarouselItemClassName;

type HomeWideCarouselRowProps<T> = {
  ariaLabel: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  action?: ReactNode;
  items: T[];
  getItemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Override the per-item width (defaults to the catalog card style). */
  itemClassName?: string;
};

export function HomeWideCarouselRow<T>({
  ariaLabel,
  title,
  description,
  actionHref,
  actionLabel = "View all",
  action,
  items,
  getItemKey,
  renderItem,
  itemClassName,
}: HomeWideCarouselRowProps<T>) {
  const catalogCardStyle = useCatalogCardStyle();
  const resolvedItemClassName =
    itemClassName ?? carouselItemClassName(catalogCardStyle);

  const trailing =
    action ??
    (actionHref ? (
      <Link href={actionHref} className={contentRowActionLinkClassName}>
        <span>{actionLabel}</span>
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    ) : undefined);

  return (
    <CatalogHubRow
      ariaLabel={ariaLabel}
      bleed
      reveal
      header={
        <CatalogHubRowToolbar
          bleed
          title={title}
          trailing={trailing}
          titleAddon={
            description ? <p className="sr-only">{description}</p> : undefined
          }
        />
      }
    >
      {items.map((item, index) => (
        <CarouselItem
          key={getItemKey(item, index)}
          className={resolvedItemClassName}
        >
          {renderItem(item, index)}
        </CarouselItem>
      ))}
    </CatalogHubRow>
  );
}
