/** Shared index hub hero layout — mobile uses absolute backdrop (no negative margin). */
export const indexHeroSectionClassName =
  "index-hero-viewport-bleed relative isolate overflow-hidden min-h-[85svh] lg:min-h-0";

export const indexHeroBackdropShellClassName =
  "pointer-events-none absolute inset-0 z-0 lg:relative lg:inset-auto lg:z-0 lg:h-[100dvh] lg:w-full lg:sticky lg:top-0";

export const indexHeroContentShellClassName =
  "relative z-20 flex min-h-[85svh] flex-col items-stretch justify-end index-rail-padding pt-12 pb-6 lg:min-h-[85dvh] lg:pb-10";

/** Desktop-only overlap onto the in-flow sticky backdrop. */
export const indexHeroContentOverlapClassName = "lg:-mt-[85dvh]";

/** Hub catalog content shell — desktop keeps rows above the sticky hero backdrop. */
export const indexHubCatalogShellClassName = "relative z-[1]";
