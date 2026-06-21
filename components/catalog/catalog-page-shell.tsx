import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type CatalogPageShellProps = {
  title: string;
  toolbar?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export const CatalogPageShell = ({
  title,
  toolbar,
  action,
  children,
  className,
}: CatalogPageShellProps) => (
  <div className="flex w-full flex-col">
    <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

    <ContentContainer className="relative z-10 flex w-full flex-col items-center">
      <section className="min-h-screen w-full pb-16 pt-14 md:pt-16">
        <div className={cn("container space-y-10", className)}>
          <header className="space-y-2 text-center md:text-left">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0 space-y-1">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                  {title}
                </h1>
              </div>
              {action ? (
                <div className="flex justify-center md:justify-end">
                  {action}
                </div>
              ) : null}
            </div>
          </header>

          {toolbar ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {toolbar}
            </div>
          ) : null}

          {children}
        </div>
      </section>
    </ContentContainer>

    <ScrollToTop />
  </div>
);
