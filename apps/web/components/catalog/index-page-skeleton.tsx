import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { StaticHero } from "@/components/hero/hero-static";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type IndexPageSkeletonBackground = "hub" | "shader";

type IndexPageSkeletonProps = {
  background?: IndexPageSkeletonBackground;
  header?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  sectionClassName?: string;
  withPageContainer?: boolean;
};

export function IndexPageSkeleton({
  background = "shader",
  header,
  toolbar,
  children,
  className,
  sectionClassName,
  withPageContainer = true,
}: IndexPageSkeletonProps) {
  const hasHubBand = background === "hub";

  const inner = (
    <div className="flex w-full flex-col">
      {hasHubBand ? (
        <div className="index-hero-viewport-bleed relative isolate h-[85dvh] max-h-[900px] overflow-hidden">
          <Skeleton className="absolute inset-0 rounded-none" />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
        </div>
      ) : (
        <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />
      )}

      <ContentContainer
        topSpacing={background !== "hub"}
        className="relative z-10 flex w-full flex-col items-stretch"
      >
        <section
          className={cn(
            "min-h-screen w-full pb-16",
            hasHubBand ? "pt-0" : "pt-14 md:pt-16",
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
    </div>
  );

  if (!withPageContainer) {
    return inner;
  }

  return <PageContainer className="bg-transparent">{inner}</PageContainer>;
}
