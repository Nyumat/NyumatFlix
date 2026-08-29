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
import { usePathname } from "next/navigation";

interface SiteNavDesktopProps {
  triggerClassName?: string;
}

export const SiteNavDesktop = ({ triggerClassName }: SiteNavDesktopProps) => {
  const flags = useFeatureFlags();
  const navigationItems = getNavigationItems(flags.liveTvEnabled);
  const pathname = usePathname();
  const parentRouteOverride = useDetailRouteParentOverride(pathname);
  const activeItem = navigationItems.find((item) =>
    isInNavGroup(pathname, item, parentRouteOverride),
  );
  const isSettingsActive = pathname.startsWith("/settings");

  const browseTileClassName = (isActive: boolean) =>
    cn(
      "group relative flex h-20 w-full flex-col justify-between rounded-xl border border-white/10 bg-white/[0.04] p-3.5 text-left text-white outline-hidden transition-all duration-150",
      "hover:border-white/20 hover:bg-white/[0.08] data-[highlighted]:border-white/20 data-[highlighted]:bg-white/[0.08]",
      isActive &&
        "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/25",
    );

  const isTrending = (title: string) => title.toLowerCase() === "trending";

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
          "w-[300px] rounded-2xl border-white/12 bg-black/90 p-2 text-white shadow-2xl shadow-black/80 backdrop-blur-2xl",
          "data-[side=bottom]:slide-in-from-top-1",
        )}
      >
        <div className="grid grid-cols-2 gap-2 p-1">
          {navigationItems.map((item) => {
            const Icon = getNavIcon(item);
            const isActive = item.title === activeItem?.title;
            const trendingItem = isTrending(item.title);

            if (trendingItem) {
              return (
                <DropdownMenuItem
                  key={item.title}
                  asChild
                  className="col-span-2 rounded-xl p-0 focus:bg-transparent data-[highlighted]:bg-transparent"
                >
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-left text-white outline-hidden transition-all duration-150",
                      "hover:border-white/20 hover:bg-white/[0.08] data-[highlighted]:border-white/20 data-[highlighted]:bg-white/[0.08]",
                      isActive &&
                        "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/25",
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
                          isActive
                            ? "text-primary font-semibold"
                            : "text-white",
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
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem
                key={item.title}
                asChild
                className="rounded-xl p-0 focus:bg-transparent data-[highlighted]:bg-transparent"
              >
                <Link
                  href={item.href}
                  className={browseTileClassName(isActive)}
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
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="my-1.5 bg-white/8" />

        <div className="p-1">
          <DropdownMenuItem
            asChild
            className="rounded-xl p-0 focus:bg-transparent data-[highlighted]:bg-transparent"
          >
            <Link
              href="/settings"
              className={cn(
                "flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-xs font-medium text-white/70 outline-hidden transition-colors duration-150",
                "hover:bg-white/[0.08] hover:text-white data-[highlighted]:bg-white/[0.08] data-[highlighted]:text-white",
                isSettingsActive && "bg-primary/10 text-primary font-semibold",
              )}
            >
              <Settings
                className={cn(
                  "size-4 shrink-0",
                  isSettingsActive ? "text-primary" : "text-white/60",
                )}
                strokeWidth={1.65}
              />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
