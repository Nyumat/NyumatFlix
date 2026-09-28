"use client";

import {
  useFeatureFlags,
  useFeatureFlagsReady,
} from "@/components/providers/feature-flags-provider";
import { SiteNav } from "@/components/layout/site-nav";
import { SiteNavDesktop } from "@/components/layout/site-nav-desktop";
import { AnniversaryBanner } from "@/components/layout/anniversary-banner";
import { Button } from "@/components/ui/button";
import { useDetailRouteParentOverride } from "@/lib/stores/detail-route-store";
import { loginHref } from "@/lib/auth/callback-url";
import { cn } from "@/lib/utils";
import { prepareNavigationBack } from "@/lib/navigation/route-restoration";
import { ChevronLeft, Search, UserRound } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BackButton } from "../../ui/back-button";
import {
  navMobileMenuClassName,
  navbarActionButtonClassName,
  navbarActionIconClassName,
} from "./navbar-action-button";
import { NavbarAuthSlot } from "./navbar-auth-slot";
import { NavbarMobileNavigation } from "./navbar-mobile-navigation";
import { UserAvatar } from "./user-avatar";

const SearchDialog = dynamic(() =>
  import("@/components/search/search").then((module) => module.SearchDialog),
);

const NavbarSearchClient = dynamic(
  () =>
    import("@/components/search/search").then(
      (module) => module.NavbarSearchClient,
    ),
  { ssr: false },
);

const DETAIL_PARENT_ROUTES: Array<{
  pattern: RegExp;
  parent: string;
}> = [
  { pattern: /^\/movies\/[^/]+(?:\/.*)?$/, parent: "/movies" },
  { pattern: /^\/tvshows\/[^/]+(?:\/.*)?$/, parent: "/tvshows" },
  { pattern: /^\/anime\/[^/]+(?:\/.*)?$/, parent: "/anime" },
  { pattern: /^\/person\/[^/]+(?:\/.*)?$/, parent: "/people" },
  {
    pattern: /^\/collection\/[^/]+(?:\/.*)?$/,
    parent: "/movies",
  },
  { pattern: /^\/watch\/[^/]+(?:\/.*)?$/, parent: "/" },
];

const getDetailRouteConfig = (pathname: string) =>
  DETAIL_PARENT_ROUTES.find(({ pattern }) => pattern.test(pathname));

const isAuthRoute = (pathname: string) =>
  pathname === "/login" || pathname.startsWith("/login/");

export const NavbarClient = () => {
  const { data: sessionData } = useSession();
  const session = sessionData ?? null;
  const { liveTvEnabled } = useFeatureFlags();
  const isCatalogRoute = (pathname: string) => {
    const patterns = [
      /^\/$/,
      /^\/movies(?:\/(?:browse|now-playing|popular|top-rated|upcoming))?$/,
      /^\/tvshows(?:\/(?:airing-today|browse|on-the-air|popular|top-rated))?$/,
      /^\/anime$/,
      ...(liveTvEnabled ? [/^\/live$/] : []),
      /^\/trending(?:\/(?:movie|people|tv))?$/,
      /^\/providers\/[^/]+$/,
      /^\/browse\/(?:country|genre)\/[^/]+$/,
      /^\/people\/popular$/,
    ];
    return patterns.some((pattern) => pattern.test(pathname));
  };

  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const onAuthRoute = isAuthRoute(pathname);
  const isSettingsRoute = pathname.startsWith("/settings");
  const detailRouteConfig = getDetailRouteConfig(pathname);
  const parentRouteOverride = useDetailRouteParentOverride(pathname);
  const isTransparentHeaderRoute =
    isCatalogRoute(pathname) || onAuthRoute || isSettingsRoute;
  const headerPositionClassName = isTransparentHeaderRoute
    ? "absolute"
    : "relative";

  useSearchDialogShortcut(setIsSearchOpen);

  if (detailRouteConfig) {
    return (
      <DetailPageActions
        parentRoute={parentRouteOverride ?? detailRouteConfig.parent}
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
      {isCatalogRoute(pathname) ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-linear-to-b from-black/70 via-black/30 to-transparent"
        />
      ) : null}
      {!onAuthRoute && <AnniversaryBanner />}
      <div className="site-container flex min-h-16 items-center gap-2 md:min-h-20 lg:gap-3">
        {!onAuthRoute ? (
          <div className="flex shrink-0 items-center gap-1 lg:gap-2">
            <BackButton />
            <SiteNav />
          </div>
        ) : null}

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

          <div className="flex">
            <NavbarAuthSlot />
          </div>
          <div className={cn("flex shrink-0", navMobileMenuClassName)}>
            <NavbarMobileNavigation session={session}>
              <NavbarSearchClient
                mode="trigger"
                onOpenDialog={() => setIsSearchOpen(true)}
              />
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
  session,
  isSearchOpen,
  setIsSearchOpen,
}: {
  parentRoute: string;
  session: Session | null;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { authEnabled } = useFeatureFlags();
  const flagsReady = useFeatureFlagsReady();
  const { status } = useSession();

  const handleBack = () => {
    if (
      typeof window !== "undefined" &&
      window.history.length > 1 &&
      prepareNavigationBack()
    ) {
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
          className={cn(navbarActionButtonClassName, "shrink-0")}
          aria-label="Go back"
          onClick={handleBack}
        >
          <ChevronLeft className="size-6" strokeWidth={2.5} />
        </Button>

        <div className="ml-auto flex items-center gap-3">
          <Suspense fallback={null}>
            <SiteNavDesktop triggerClassName={navbarActionButtonClassName} />
          </Suspense>
          <Button
            variant="ghost"
            size="icon"
            className={navbarActionButtonClassName}
            aria-label="Search"
            onClick={() => setIsSearchOpen(true)}
          >
            <Search className={navbarActionIconClassName} strokeWidth={1.75} />
          </Button>
          <Suspense fallback={null}>
            <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
          </Suspense>

          <div className={cn("flex shrink-0", navMobileMenuClassName)}>
            <NavbarMobileNavigation session={session}>
              <NavbarSearchClient />
            </NavbarMobileNavigation>
          </div>

          {session ? (
            <UserAvatar session={session} />
          ) : status === "loading" && flagsReady && authEnabled ? (
            <div
              className={cn(
                navbarActionButtonClassName,
                "inline-flex size-9 shrink-0 animate-pulse rounded-md bg-muted/40",
              )}
              aria-hidden
            />
          ) : flagsReady && authEnabled ? (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className={navbarActionButtonClassName}
            >
              <Link href={loginHref(pathname)} aria-label="Sign in">
                <UserRound
                  className={navbarActionIconClassName}
                  strokeWidth={1.75}
                />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
};
