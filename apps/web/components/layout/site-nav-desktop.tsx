"use client";

import {
  navBrowseMenuClassName,
  navbarActionButtonClassName,
  navbarActionIconClassName,
} from "@/components/layout/nav/navbar-action-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { getNavigationItems } from "@/lib/navigation";
import { useDetailRouteParentOverride } from "@/lib/stores/detail-route-store";
import { getNavIcon, isInNavGroup, toTitleCase } from "@/lib/nav/browse";
import { cn } from "@/lib/utils";
import { Check, LayoutGrid, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

interface SiteNavDesktopProps {
  triggerClassName?: string;
}

const menuItemShellClassName =
  "rounded-none p-0 focus:bg-transparent data-[highlighted]:bg-transparent";

const browseCellClassName = (isActive: boolean) =>
  cn(
    "group relative flex h-20 w-full flex-col justify-between p-3.5 text-left text-white outline-hidden transition-colors duration-150",
    "hover:bg-white/[0.06] data-[highlighted]:bg-white/[0.06]",
    isActive && "bg-primary/10 text-primary",
  );

const browseTrendingClassName = (isActive: boolean) =>
  cn(
    "group flex h-12 w-full items-center justify-between px-3.5 text-left text-white outline-hidden transition-colors duration-150",
    "hover:bg-white/[0.06] data-[highlighted]:bg-white/[0.06]",
    isActive && "bg-primary/10 text-primary",
  );

const useRoutePrefetchOnHover = () => {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulePrefetch = useCallback(
    (href: string) => {
      if (timeoutRef.current) return;
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        router.prefetch(href);
      }, 120);
    },
    [router],
  );

  const cancelPrefetch = useCallback(() => {
    if (!timeoutRef.current) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  useEffect(() => cancelPrefetch, [cancelPrefetch]);

  return { schedulePrefetch, cancelPrefetch };
};

const routePrefetchHandlers = (
  href: string,
  schedulePrefetch: (href: string) => void,
  cancelPrefetch: () => void,
) => ({
  onPointerEnter: () => schedulePrefetch(href),
  onPointerLeave: cancelPrefetch,
  onFocus: () => schedulePrefetch(href),
  onBlur: cancelPrefetch,
});

export const SiteNavDesktop = ({ triggerClassName }: SiteNavDesktopProps) => {
  const flags = useFeatureFlags();
  const navigationItems = getNavigationItems(flags.liveTvEnabled);
  const pathname = usePathname();
  const parentRouteOverride = useDetailRouteParentOverride(pathname);
  const activeItem = navigationItems.find((item) =>
    isInNavGroup(pathname, item, parentRouteOverride),
  );
  const isSettingsActive = pathname.startsWith("/settings");

  const isTrending = (title: string) => title.toLowerCase() === "trending";
  const gridItems = navigationItems.filter((item) => !isTrending(item.title));
  const trendingItem = navigationItems.find((item) => isTrending(item.title));
  const totalRows = Math.ceil(gridItems.length / 2);
  const TrendingIcon = trendingItem ? getNavIcon(trendingItem) : null;
  const isTrendingActive = trendingItem?.title === activeItem?.title;
  const { schedulePrefetch, cancelPrefetch } = useRoutePrefetchOnHover();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          id="browse-menu-trigger"
          suppressHydrationWarning
          aria-label="Browse"
          className={cn(
            navbarActionButtonClassName,
            triggerClassName,
            navBrowseMenuClassName,
            "focus-visible:outline-hidden focus-visible:ring-2",
            "data-[state=open]:border-white/25 data-[state=open]:bg-white/10 data-[state=open]:text-white data-[state=open]:ring-white/20",
          )}
        >
          <LayoutGrid
            className={navbarActionIconClassName}
            strokeWidth={1.75}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={cn(
          "w-[300px] overflow-hidden rounded-2xl border-white/12 bg-black/90 p-0 text-white shadow-2xl shadow-black/80 backdrop-blur-2xl",
          "data-[side=bottom]:slide-in-from-top-1",
        )}
      >
        <div className="grid grid-cols-2">
          {gridItems.map((item, index) => {
            const Icon = getNavIcon(item);
            const isActive = item.title === activeItem?.title;
            const col = index % 2;
            const row = Math.floor(index / 2);

            return (
              <DropdownMenuItem
                key={item.title}
                asChild
                className={menuItemShellClassName}
              >
                <Link
                  href={item.href}
                  prefetch={false}
                  {...routePrefetchHandlers(
                    item.href,
                    schedulePrefetch,
                    cancelPrefetch,
                  )}
                  className={cn(
                    browseCellClassName(isActive),
                    col === 0 && "border-r border-white/10",
                    (row < totalRows - 1 || trendingItem) &&
                      "border-b border-white/10",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        isActive
                          ? "text-primary"
                          : "text-white/70 group-hover:text-white",
                      )}
                      strokeWidth={1.65}
                    />
                    {isActive ? (
                      <Check
                        className="size-3 shrink-0 text-primary"
                        strokeWidth={2}
                      />
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold tracking-tight",
                      isActive ? "text-primary" : "text-white",
                    )}
                  >
                    {toTitleCase(item.title)}
                  </span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>

        {trendingItem && TrendingIcon ? (
          <DropdownMenuItem asChild className={menuItemShellClassName}>
            <Link
              href={trendingItem.href}
              prefetch={false}
              {...routePrefetchHandlers(
                trendingItem.href,
                schedulePrefetch,
                cancelPrefetch,
              )}
              className={cn(
                browseTrendingClassName(Boolean(isTrendingActive)),
                "border-t border-white/10",
              )}
            >
              <div className="flex items-center gap-2.5">
                <TrendingIcon
                  className="size-4 shrink-0 text-amber-400"
                  strokeWidth={1.75}
                />
                <span
                  className={cn(
                    "text-base font-medium",
                    isTrendingActive
                      ? "font-semibold text-primary"
                      : "text-white",
                  )}
                >
                  {toTitleCase(trendingItem.title)}
                </span>
              </div>
              {isTrendingActive ? (
                <Check
                  className="size-3.5 shrink-0 text-primary"
                  strokeWidth={1.75}
                />
              ) : null}
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator className="m-0 h-px bg-white/8" />

        <DropdownMenuItem asChild className={menuItemShellClassName}>
          <Link
            href="/settings"
            prefetch={false}
            {...routePrefetchHandlers(
              "/settings",
              schedulePrefetch,
              cancelPrefetch,
            )}
            className={cn(
              "flex h-10 w-full items-center gap-2.5 px-3.5 text-sm font-medium text-white/70 outline-hidden transition-colors duration-150",
              "hover:bg-white/[0.06] hover:text-white data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-white",
              isSettingsActive && "bg-primary/10 font-semibold text-primary",
            )}
          >
            <Settings
              className={cn(
                "size-3.5 shrink-0",
                isSettingsActive ? "text-primary" : "text-white/60",
              )}
              strokeWidth={1.65}
            />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
