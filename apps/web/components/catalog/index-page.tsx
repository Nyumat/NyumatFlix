import { ContentContainer } from "@/components/layout/content-container";
import { IndexHeroTransitionProvider } from "@/components/catalog/index-hero-transition-context";
import {
  AmbientPageBackdrop,
  type PageBackdrop,
} from "@/components/hero/ambient-page-backdrop";
import { StaticHero } from "@/components/hero/hero-static";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { indexHubCatalogShellClassName } from "@/lib/hero-shell-layout";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type IndexPageBackground = "hub" | "shader";

type IndexPageProps = {
  /** Hub surfaces use the ambient blurred still; list/discover-results use the silk banner. */
  background?: IndexPageBackground;
  backdrop?: PageBackdrop | null;
  /** Full carousel backdrop stack for the hub hero — avoids client-only ambient paint. */
  heroBackdrops?: Array<PageBackdrop | null>;
  header?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  sectionClassName?: string;
  contentTopSpacing?: boolean;
};

/**
 * Shared catalog page wrapper. Keeps the established banner backdrop while
 * giving index surfaces a consistent header, toolbar, and content rhythm.
 */
export function IndexPage({
  background = "shader",
  backdrop,
  heroBackdrops,
  header,
  toolbar,
  children,
  className,
  sectionClassName,
  contentTopSpacing,
}: IndexPageProps) {
  const isHubLayout = background === "hub";
  const resolvedContentTopSpacing = contentTopSpacing ?? !isHubLayout;
  const initialBackdrops =
    heroBackdrops && heroBackdrops.length > 0
      ? heroBackdrops
      : backdrop?.imageUrl
        ? [backdrop]
        : [];

  return (
    <IndexHeroTransitionProvider initialBackdrops={initialBackdrops}>
      <div className="flex w-full flex-col">
        {isHubLayout ? (
          <AmbientPageBackdrop backdrop={backdrop ?? null} />
        ) : (
          <StaticHero
            imageUrl="/movie-banner.webp"
            title=""
            route=""
            hideTitle
          />
        )}

        <ContentContainer
          topSpacing={resolvedContentTopSpacing}
          className="relative z-10 flex w-full flex-col items-stretch"
        >
          <section
            className={cn(
              "min-h-screen w-full pb-16",
              isHubLayout ? "pt-0" : "pt-14 md:pt-16",
              sectionClassName,
            )}
          >
            <div
              className={cn(
                "index-container space-y-8 md:space-y-10 lg:space-y-12",
                isHubLayout && indexHubCatalogShellClassName,
                className,
              )}
            >
              {header}
              {toolbar}
              {children}
            </div>
          </section>
        </ContentContainer>

        <ScrollToTop />
      </div>
    </IndexHeroTransitionProvider>
  );
}
