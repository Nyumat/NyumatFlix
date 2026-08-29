import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import type { ReactNode } from "react";

interface PageLoadingShellProps {
  children: ReactNode;
  className?: string;
  withPageContainer?: boolean;
  contentTopSpacing?: boolean;
}

export function PageLoadingShell({
  children,
  className,
  withPageContainer = true,
  contentTopSpacing = true,
}: PageLoadingShellProps) {
  const content = (
    <>
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />
      <ContentContainer
        topSpacing={contentTopSpacing}
        className="relative z-10 flex w-full flex-col items-center"
      >
        {children}
      </ContentContainer>
    </>
  );

  if (!withPageContainer) {
    return <div className={className}>{content}</div>;
  }

  return <PageContainer className={className}>{content}</PageContainer>;
}

export function WatchlistLoadingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />
      <ContentContainer className="z-10 flex w-full flex-1 flex-col items-center">
        {children}
      </ContentContainer>
    </div>
  );
}
