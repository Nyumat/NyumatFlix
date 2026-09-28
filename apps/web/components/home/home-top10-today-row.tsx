"use client";

import { BackdropTopRankRibbon } from "@/components/cards/backdrop-top-rank-ribbon";
import { PosterCaptionCard } from "@/components/cards/poster-caption-card";
import { CatalogHubRow } from "@/components/catalog/catalog-hub-row";
import { ContentRowHeader } from "@/components/content/content-row-header";
import { RankedBackdropCard } from "@/components/content/ranked-backdrop-card";
import { CarouselItem } from "@/components/ui/carousel";
import {
  carouselItemClassName,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import {
  type CatalogMediaCard,
  toCanonicalHubCard,
} from "@/lib/cards/catalog-dto";
import type { CanonicalMediaCard } from "@/lib/domain/typings";

const TOP10_TITLE = "Top 10 Today";
const TOP10_HREF = "/trending";

function Top10PosterRankedCard({
  item,
  rank,
}: {
  item: CanonicalMediaCard;
  rank: number;
}) {
  return (
    <PosterCaptionCard
      item={item}
      frameOverlay={<BackdropTopRankRibbon rank={rank} />}
    />
  );
}

export function HomeTop10Row({ items }: { items: CatalogMediaCard[] }) {
  const isWide = useCatalogCardStyle() === "backdrop";

  return (
    <CatalogHubRow
      ariaLabel={TOP10_TITLE}
      bleed
      header={<ContentRowHeader bleed title={TOP10_TITLE} href={TOP10_HREF} />}
    >
      {items.map((item, index) => {
        const rowItem = toCanonicalHubCard(item);
        return (
          <CarouselItem
            key={`${rowItem.id}-${index}`}
            className={
              isWide
                ? carouselItemClassName("backdrop")
                : "basis-[44%] pl-3 sm:basis-[32%] md:basis-[23%] lg:basis-[18.5%] lg:pl-4"
            }
          >
            {isWide ? (
              <RankedBackdropCard
                item={rowItem}
                rank={index + 1}
                variant="ribbon"
              />
            ) : (
              <Top10PosterRankedCard item={rowItem} rank={index + 1} />
            )}
          </CarouselItem>
        );
      })}
    </CatalogHubRow>
  );
}
