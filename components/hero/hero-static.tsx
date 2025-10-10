"use client";

import { usePathname } from "next/navigation";
import { BackgroundImage } from "./carousel-background";
import { HeroProps } from "./types";

export function StaticHero({
  imageUrl,
  title,
  route,
  logo,
  hideTitle = false,
}: HeroProps) {
  const pathname = usePathname();
  const isSearchPage = pathname === "/search" || !!route;
  const isBrowsePage = pathname.includes("/browse");
  const isLegalPage =
    pathname.includes("/terms") ||
    pathname.includes("/privacy") ||
    pathname.includes("/cookie-policy") ||
    pathname.includes("/dmca");
  const isFullPageBackground = isSearchPage || isBrowsePage || isLegalPage;

  return (
    <>
      <BackgroundImage
        isFullPage={isFullPageBackground}
        imageUrl={imageUrl}
        title={route || title}
        logo={logo}
        hideTitle={hideTitle}
      />
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 opacity-70 -z-10" />
    </>
  );
}
