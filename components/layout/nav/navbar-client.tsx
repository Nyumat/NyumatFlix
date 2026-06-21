"use client";

import { SiteNav } from "@/components/layout/site-nav";
import { SiteNavDesktop } from "@/components/layout/site-nav-desktop";
import { AnniversaryBanner } from "@/components/layout/anniversary-banner";
import { NavbarSearchClient, SearchDialog } from "@/components/search/search";
import { Button } from "@/components/ui/button";
import { useDetailRouteParentOverride } from "@/lib/stores/detail-route-store";
import { cn } from "@/lib/utils";
import { ChevronLeft, Search, UserRound } from "lucide-react";
import Link from "next/link";
import type { Session } from "next-auth";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BackButton } from "../../ui/back-button";
import {
  navMobileMenuClassName,
  navbarActionButtonClassName,
  navbarActionIconClassName,
} from "./navbar-action-button";
import { NavbarAuth } from "./navbar-auth";
import { NavbarMobileNavigation } from "./navbar-mobile-navigation";
import { UserAvatar } from "./user-avatar";

interface NavbarClientProps {
  session: Session | null;
}

const DETAIL_PARENT_ROUTES: Array<{
  pattern: RegExp;
  parent: string;
  preferHistory?: boolean;
}> = [
  { pattern: /^\/movies\/[^/]+(?:\/.*)?$/, parent: "/movies" },
  { pattern: /^\/tvshows\/[^/]+(?:\/.*)?$/, parent: "/tvshows" },
  { pattern: /^\/person\/[^/]+(?:\/.*)?$/, parent: "/people/popular" },
  {
    pattern: /^\/collection\/[^/]+(?:\/.*)?$/,
    parent: "/movies",
    preferHistory: true,
  },
  { pattern: /^\/watch\/[^/]+(?:\/.*)?$/, parent: "/" },
];

const getDetailRouteConfig = (pathname: string) =>
  DETAIL_PARENT_ROUTES.find(({ pattern }) => pattern.test(pathname));

const CATALOG_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/movies(?:\/(?:browse|now-playing|popular|top-rated|upcoming))?$/,
  /^\/tvshows(?:\/(?:airing-today|browse|on-the-air|popular|top-rated))?$/,
  /^\/anime$/,
  /^\/live$/,
  /^\/trending(?:\/(?:movie|people|tv))?$/,
  /^\/browse\/(?:country|genre)\/[^/]+$/,
  /^\/people\/popular$/,
];

const isCatalogRoute = (pathname: string) =>
  CATALOG_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));

const isAuthRoute = (pathname: string) =>
  pathname === "/login" || pathname.startsWith("/login/");

const detailNavbarActionButtonClassName =
  "border-white/25 bg-black/35 text-white shadow-lg shadow-black/35 ring-white/20 hover:border-white/35 hover:bg-black/45 hover:ring-white/30";

export const NavbarClient = ({ session }: NavbarClientProps) => {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const detailRouteConfig = getDetailRouteConfig(pathname);
  const parentRouteOverride = useDetailRouteParentOverride(pathname);
  const isTransparentHeaderRoute =
    isCatalogRoute(pathname) || isAuthRoute(pathname);
  const headerPositionClassName = isTransparentHeaderRoute
    ? "absolute"
    : "sticky";

  useSearchDialogShortcut(setIsSearchOpen);

  if (detailRouteConfig) {
    return (
      <DetailPageActions
        parentRoute={parentRouteOverride ?? detailRouteConfig.parent}
        preferHistory={detailRouteConfig.preferHistory}
        session={session}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
      />
    );
  }

  return (
    <header
      className={cn(
        headerPositionClassName,
        "top-0 z-50 w-full bg-transparent",
      )}
    >
      {!isAuthRoute(pathname) && pathname !== "/live" && <AnniversaryBanner />}
      <div className="site-container flex min-h-14 items-center gap-2 py-2.5 lg:gap-3">
        <div className="flex shrink-0 items-center gap-1 lg:gap-2">
          <BackButton />
          <SiteNav />
        </div>

        <div className="min-w-0 flex-1" />

        <div className="ml-auto flex items-center gap-3">
          <Suspense fallback={null}>
            <SiteNavDesktop triggerClassName={navbarActionButtonClassName} />
          </Suspense>
          <Button
            variant="ghost"
            size="icon"
            className={cn(navbarActionButtonClassName, "hidden md:inline-flex")}
            aria-label="Search"
            onClick={() => setIsSearchOpen(true)}
          >
            <Search className={navbarActionIconClassName} strokeWidth={1.75} />
          </Button>
          <Suspense fallback={null}>
            <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
          </Suspense>

          <div className="hidden md:flex">
            <NavbarAuth session={session} />
          </div>
          <div className={cn("flex shrink-0", navMobileMenuClassName)}>
            <NavbarMobileNavigation session={session}>
              <NavbarSearchClient />
            </NavbarMobileNavigation>
          </div>
        </div>
      </div>
    </header>
  );
};

const useSearchDialogShortcut = (setIsSearchOpen: (open: boolean) => void) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey)
      ) {
        return;
      }

      event.preventDefault();
      setIsSearchOpen(true);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setIsSearchOpen]);
};

const DetailPageActions = ({
  parentRoute,
  preferHistory = false,
  session,
  isSearchOpen,
  setIsSearchOpen,
}: {
  parentRoute: string;
  preferHistory?: boolean;
  session: Session | null;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (!preferHistory || typeof window === "undefined") {
      router.push(parentRoute);
      return;
    }

    const referrer = document.referrer ? new URL(document.referrer) : null;
    const hasSameOriginReferrer = referrer?.origin === window.location.origin;

    if (hasSameOriginReferrer && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(parentRoute);
  };

  return (
    <header className="absolute top-0 z-50 w-full bg-transparent">
      <AnniversaryBanner />
      <div className="mx-auto flex min-h-14 max-w-screen items-center justify-between px-8 py-6">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            navbarActionButtonClassName,
            detailNavbarActionButtonClassName,
            "shrink-0",
          )}
          aria-label={preferHistory ? "Go back" : "Back to parent page"}
          onClick={handleBack}
        >
          <ChevronLeft className="size-6" strokeWidth={2.5} />
        </Button>

        <div className="ml-auto flex items-center gap-3">
          <Suspense fallback={null}>
            <SiteNavDesktop
              triggerClassName={cn(
                navbarActionButtonClassName,
                detailNavbarActionButtonClassName,
              )}
            />
          </Suspense>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              navbarActionButtonClassName,
              detailNavbarActionButtonClassName,
            )}
            aria-label="Search"
            onClick={() => setIsSearchOpen(true)}
          >
            <Search className={navbarActionIconClassName} strokeWidth={1.75} />
          </Button>
          <Suspense fallback={null}>
            <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
          </Suspense>

          <div className={cn("flex shrink-0", navMobileMenuClassName)}>
            <NavbarMobileNavigation
              session={session}
              triggerClassName={detailNavbarActionButtonClassName}
            >
              <NavbarSearchClient />
            </NavbarMobileNavigation>
          </div>

          {session ? (
            <UserAvatar
              session={session}
              triggerClassName={detailNavbarActionButtonClassName}
            />
          ) : (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={cn(
                navbarActionButtonClassName,
                detailNavbarActionButtonClassName,
              )}
            >
              <Link href="/login" aria-label="Sign in">
                <UserRound
                  className={navbarActionIconClassName}
                  strokeWidth={1.75}
                />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
