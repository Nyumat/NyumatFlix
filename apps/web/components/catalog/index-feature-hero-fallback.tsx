import { HeroContentSkeleton } from "@/components/hero/hero-content-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  indexHeroBackdropShellClassName,
  indexHeroContentOverlapClassName,
  indexHeroContentShellClassName,
  indexHeroSectionClassName,
} from "@/lib/hero-shell-layout";
import { cn } from "@/lib/utils";

/**
 * Mirrors `IndexFeatureHero`: full-bleed backdrop with the same fade mask,
 * bottom-anchored logo, one action bar, and carousel dots — enough shape to
 * read as the live hero without faking every meta chip and button.
 */
export const IndexFeatureHeroFallback = () => (
  <section className={indexHeroSectionClassName} aria-hidden>
    <div className={indexHeroBackdropShellClassName}>
      <div className="absolute top-0 left-1/2 z-0 h-full w-screen max-w-[100vw] -translate-x-1/2">
        <div className="relative h-full w-full overflow-hidden bg-white/[0.06] [mask-image:linear-gradient(to_bottom,black_40%,transparent_98%)]">
          <Skeleton className="absolute inset-0 rounded-none" />
          <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-linear-to-r from-black/45 via-transparent to-transparent" />
        </div>
      </div>
    </div>

    <div
      className={cn(
        indexHeroContentShellClassName,
        indexHeroContentOverlapClassName,
      )}
    >
      <HeroContentSkeleton variant="index" align="index-hub" />

      <div className="mt-4 flex justify-center lg:absolute lg:right-8 lg:bottom-8 lg:mt-0 lg:justify-end">
        <Skeleton className="h-2 w-12 rounded-full" />
      </div>
    </div>
  </section>
);
