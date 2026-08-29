"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NavbarSearchClientProps } from "@/components/search/search";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { type NavItem } from "@/config/site";
import { getNavigationItems } from "@/lib/navigation";
import { useWatchlistSummary } from "@/hooks/useWatchlistSummary";
import { useDetailRouteParentOverride } from "@/lib/stores/detail-route-store";
import { getNavIcon, isInNavGroup, toTitleCase } from "@/lib/nav/browse";
import { ProfileAvatar } from "@/components/user/profile-avatar";
import { loginHref } from "@/lib/auth/callback-url";
import { resolveAuthSession } from "@/lib/auth/session-state";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronRight,
  List,
  LogIn,
  LogOut,
  Menu,
  Settings,
} from "lucide-react";
import type { Session } from "next-auth";
import { signOut, useSession } from "next-auth/react";
import { BrandLogo, BRAND_NAME } from "@/components/brand-logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  navMobileMenuClassName,
  navbarActionButtonClassName,
  navbarActionIconClassName,
} from "./navbar-action-button";

interface NavbarMobileNavigationProps {
  children: React.ReactNode;
  session: Session | null;
  triggerClassName?: string;
}

const drawerSurfaceClassName =
  "border border-white/10 bg-card/45 backdrop-blur-md dark:border-white/30 dark:bg-white/10";

const mobileNavTileClassName = (isActive: boolean) =>
  cn(
    "group flex h-20 w-full flex-col justify-between rounded-xl p-3.5 text-left text-white outline-hidden transition-all duration-150",
    drawerSurfaceClassName,
    "hover:border-white/20 hover:bg-white/10 active:scale-[0.98]",
    isActive &&
      "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/20",
  );

const mobileNavActionClassName = (isActive = false) =>
  cn(
    "flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-white transition-colors duration-150",
    drawerSurfaceClassName,
    "hover:border-white/20 hover:bg-white/10",
    isActive &&
      "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/20",
  );

export const NavbarMobileNavigation = ({
  children,
  session,
  triggerClassName,
}: NavbarMobileNavigationProps) => {
  const { liveTvEnabled, authEnabled } = useFeatureFlags();
  const navigationItems = getNavigationItems(liveTvEnabled);
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const parentRouteOverride = useDetailRouteParentOverride(pathname);
  const { data: clientSession, status } = useSession();
  const activeSession = resolveAuthSession(clientSession, status, session);

  const { data: watchlistSummary, isLoading: isWatchlistLoading } =
    useWatchlistSummary(open && Boolean(activeSession));

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  const handleLinkClick = () => {
    setOpen(false);
  };

  const userEmail = activeSession?.user?.email || "";
  const userName = activeSession?.user?.name;
  const userImage = activeSession?.user?.image;

  const searchContent =
    isValidElement(children) && typeof children.type !== "string"
      ? cloneElement(children as React.ReactElement<NavbarSearchClientProps>, {
          onAfterNavigation: () => {
            handleLinkClick();
            (
              children as React.ReactElement<NavbarSearchClientProps>
            ).props.onAfterNavigation?.();
          },
          className: "mx-0 max-w-none",
          onOpenDialog: () => {
            handleLinkClick();
            (
              children as React.ReactElement<NavbarSearchClientProps>
            ).props.onOpenDialog?.();
          },
          mode: (children as React.ReactElement<NavbarSearchClientProps>).props
            .mode,
        })
      : children;

  const activeItem = navigationItems.find((item) =>
    isInNavGroup(pathname, item, parentRouteOverride),
  );
  const isSettingsActive = pathname.startsWith("/settings");

  if (!isMounted) {
    return (
      <div className={navMobileMenuClassName}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle navigation menu"
          className={cn(navbarActionButtonClassName, triggerClassName)}
        >
          <Menu className={navbarActionIconClassName} strokeWidth={1.75} />
        </Button>
      </div>
    );
  }

  return (
    <div className={navMobileMenuClassName}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            ref={menuTriggerRef}
            variant="ghost"
            size="icon"
            aria-label="Toggle navigation menu"
            className={cn(navbarActionButtonClassName, triggerClassName)}
          >
            <Menu className={navbarActionIconClassName} strokeWidth={1.75} />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            menuTriggerRef.current?.focus();
          }}
          className={cn(
            "w-[min(92vw,400px)] gap-0 p-0 flex flex-col overflow-hidden",
            "border-r border-white/12 bg-black/92 backdrop-blur-xl",
            "shadow-2xl shadow-black/60",
          )}
        >
          <SheetHeader className="border-b border-white/10 px-5 py-4 text-left">
            <div className="flex items-center pr-10">
              <BrandLogo placement="mobile-menu" onClick={handleLinkClick} />
              <SheetTitle className="sr-only">{BRAND_NAME}</SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="space-y-4 px-4 py-4">
              {searchContent}

              {activeSession ? (
                <LoggedInProfileCard
                  userEmail={userEmail}
                  userName={userName}
                  userImage={userImage}
                  watchlistSummary={watchlistSummary}
                  isWatchlistLoading={isWatchlistLoading}
                  onNavigate={handleLinkClick}
                />
              ) : null}

              <section className="space-y-3">
                <p className="px-1 text-sm font-medium text-white/70">Browse</p>

                <MobileBrowseRoot
                  items={navigationItems}
                  activeTitle={activeItem?.title}
                  onNavigate={handleLinkClick}
                />
              </section>

              <Link
                href="/settings"
                onClick={handleLinkClick}
                className={mobileNavActionClassName(isSettingsActive)}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Settings
                    className={cn(
                      "size-4 shrink-0",
                      isSettingsActive ? "text-primary" : "text-white/80",
                    )}
                  />
                  Settings
                </span>
                <ChevronRight className="size-4 shrink-0 text-white/45" />
              </Link>
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/40 px-4 py-4 backdrop-blur-md">
            {activeSession ? (
              <button
                type="button"
                onClick={handleSignOut}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-white/85 transition",
                  drawerSurfaceClassName,
                  "hover:border-white/25 hover:bg-white/15 hover:text-white",
                )}
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            ) : authEnabled ? (
              <Button asChild variant="chrome" className="w-full gap-2">
                <Link href={loginHref(pathname)} onClick={handleLinkClick}>
                  Sign in
                  <LogIn className="size-4 shrink-0" />
                </Link>
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const LoggedInProfileCard = ({
  userEmail,
  userName,
  userImage,
  watchlistSummary,
  isWatchlistLoading,
  onNavigate,
}: {
  userEmail: string;
  userName?: string | null;
  userImage?: string | null;
  watchlistSummary?: {
    total: number;
    watching: number;
    waiting: number;
    finished: number;
  };
  isWatchlistLoading: boolean;
  onNavigate: () => void;
}) => (
  <div className={cn("overflow-hidden rounded-xl", drawerSurfaceClassName)}>
    <div className="border-b border-white/10 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <ProfileAvatar
          image={userImage}
          name={userName}
          email={userEmail}
          size={48}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {userName || "Your account"}
          </p>
          <p className="truncate text-xs text-white/60">{userEmail}</p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-2 px-3 py-3">
      <WatchlistStat
        label="Watching"
        value={watchlistSummary?.watching}
        isLoading={isWatchlistLoading}
      />
      <WatchlistStat
        label="Waiting"
        value={watchlistSummary?.waiting}
        isLoading={isWatchlistLoading}
      />
      <WatchlistStat
        label="Finished"
        value={watchlistSummary?.finished}
        isLoading={isWatchlistLoading}
      />
    </div>

    <Link
      href="/watchlist"
      onClick={onNavigate}
      className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
    >
      <span className="inline-flex items-center gap-2">
        <List className="size-4 text-primary" />
        My Watchlist
        {!isWatchlistLoading && watchlistSummary ? (
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-white/70">
            {watchlistSummary.total}
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-4 text-white/45" />
    </Link>
  </div>
);

const WatchlistStat = ({
  label,
  value,
  isLoading,
}: {
  label: string;
  value?: number;
  isLoading: boolean;
}) => (
  <div
    className={cn("rounded-lg px-2.5 py-2 text-center", drawerSurfaceClassName)}
  >
    {isLoading ? (
      <Skeleton className="mx-auto h-5 w-8 rounded-md bg-white/10" />
    ) : (
      <p className="text-lg font-semibold text-white">{value ?? 0}</p>
    )}
    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-white/45">
      {label}
    </p>
  </div>
);

const MobileBrowseRoot = ({
  items,
  activeTitle,
  onNavigate,
}: {
  items: NavItem[];
  activeTitle?: string;
  onNavigate: () => void;
}) => {
  const isTrending = (title: string) => title.toLowerCase() === "trending";

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const Icon = getNavIcon(item);
        const isActive = item.title === activeTitle;
        const trendingItem = isTrending(item.title);

        if (trendingItem) {
          return (
            <Link
              key={item.title}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "col-span-2 group flex h-12 w-full items-center justify-between rounded-xl p-3.5 text-left text-white outline-hidden transition-all duration-150",
                drawerSurfaceClassName,
                "hover:border-white/20 hover:bg-white/10 active:scale-[0.98]",
                isActive &&
                  "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/20",
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className="size-5 shrink-0 text-amber-400"
                  strokeWidth={1.75}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    isActive ? "text-primary font-semibold" : "text-white",
                  )}
                >
                  {toTitleCase(item.title)}
                </span>
              </div>
              {isActive ? (
                <Check
                  className="size-4 shrink-0 text-primary"
                  strokeWidth={1.75}
                />
              ) : null}
            </Link>
          );
        }

        return (
          <Link
            key={item.title}
            href={item.href}
            onClick={onNavigate}
            className={mobileNavTileClassName(isActive)}
          >
            <div className="flex w-full items-center justify-between">
              <Icon
                className="size-5 shrink-0 text-white/70 group-hover:text-white"
                strokeWidth={1.65}
              />
              {isActive ? (
                <Check
                  className="size-3.5 shrink-0 text-primary"
                  strokeWidth={2}
                />
              ) : null}
            </div>
            <span
              className={cn(
                "text-xs font-semibold tracking-tight",
                isActive ? "text-primary" : "text-white",
              )}
            >
              {toTitleCase(item.title)}
            </span>
          </Link>
        );
      })}
    </div>
  );
};
