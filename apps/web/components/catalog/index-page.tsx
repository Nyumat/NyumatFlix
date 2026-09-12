import { ContentContainer } from "@/components/layout/content-container";
import {
  AmbientPageBackdrop,
  type PageBackdrop,
} from "@/components/hero/ambient-page-backdrop";
import { StaticHero } from "@/components/hero/hero-static";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type IndexPageProps = {
  backdrop?: PageBackdrop | null;
  header?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  sectionClassName?: string;
};

/**
 * Shared catalog page wrapper. Keeps the established banner backdrop while
 * giving index surfaces a consistent header, toolbar, and content rhythm.
 */
export function IndexPage({
  backdrop,
  header,
  toolbar,
  children,
  className,
  sectionClassName,
}: IndexPageProps) {
  const hasAmbientBackdrop = Boolean(backdrop?.imageUrl);

  return (
    <div className="flex w-full flex-col">
      {hasAmbientBackdrop ? (
        <AmbientPageBackdrop backdrop={backdrop} />
      ) : (
        <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />
      )}

      <ContentContainer
        topSpacing={!hasAmbientBackdrop}
        className="relative z-10 flex w-full flex-col items-center"
      >
        <section
          className={cn(
            "min-h-screen w-full pb-16",
            hasAmbientBackdrop ? "pt-0" : "pt-14 md:pt-16",
            sectionClassName,
          )}
        >
          <div
            className={cn(
              "index-container space-y-8 md:space-y-10 lg:space-y-12",
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
  );
}
