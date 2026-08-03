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
import { getNavIcon, isInNavGroup, toTitleCase } from "@/lib/nav/browse";
import { cn } from "@/lib/utils";
import { BrowseSettings } from "@/components/layout/nav/browse-settings";
import { Check, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SiteNavDesktopProps {
  triggerClassName?: string;
}

export const SiteNavDesktop = ({ triggerClassName }: SiteNavDesktopProps) => {
  const flags = useFeatureFlags();
  const navigationItems = getNavigationItems(flags.liveTvEnabled);
  const pathname = usePathname();
  const activeItem = navigationItems.find((item) =>
    isInNavGroup(pathname, item),
  );

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
          "w-[320px] rounded-lg border-white/12 bg-black/92 p-0 text-white shadow-2xl shadow-black/60 backdrop-blur-xl",
          "data-[side=bottom]:slide-in-from-top-1",
        )}
      >
        <div className="px-4 py-3 text-center text-sm font-medium">Browse</div>
        <DropdownMenuSeparator className="m-0 bg-white/8" />

        <div className="space-y-3 p-3">
          <p className="px-1 text-xs font-normal tracking-wide text-muted-foreground">
            Content
          </p>
          <div className="grid grid-cols-2 gap-2">
            {navigationItems.map((item) => {
              const Icon = getNavIcon(item);
              const isActive = item.title === activeItem?.title;

              return (
                <DropdownMenuItem
                  key={item.title}
                  asChild
                  className="rounded-md p-0 focus:bg-transparent"
                >
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex h-[72px] cursor-pointer flex-col items-start justify-between rounded-md border border-white/10 bg-card/55 p-3 text-left text-white outline-hidden transition-all",
                      "hover:border-white/25 hover:bg-white/8 focus:border-primary/35 focus:bg-primary/10",
                      isActive &&
                        "border-primary/35 bg-primary/10 text-primary ring-1 ring-primary/25",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <Icon className="size-5" strokeWidth={1.65} />
                      {isActive ? (
                        <Check className="size-4" strokeWidth={1.75} />
                      ) : null}
                    </div>
                    <span className="text-sm font-normal text-white">
                      {toTitleCase(item.title)}
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </div>
        </div>

        <BrowseSettings variant="desktop" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
