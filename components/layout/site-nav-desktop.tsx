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
import { navigation, type NavItem } from "@/config/site";
import {
  getBrowseLinkLabel,
  getBrowseLinks,
  getNavIcon,
  hasBrowseSubmenu,
  isCurrentHref,
  isInNavGroup,
  toTitleCase,
} from "@/lib/nav/browse";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

type SetMenuValue = (value: string | null) => void;

interface SiteNavDesktopProps {
  triggerClassName?: string;
}

export const SiteNavDesktop = ({ triggerClassName }: SiteNavDesktopProps) => {
  const [detailItemTitle, setDetailItemTitle] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeItem = navigation.items.find((item) =>
    isInNavGroup(pathname, searchParams, item),
  );
  const detailItem = detailItemTitle
    ? navigation.items.find((item) => item.title === detailItemTitle)
    : null;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setDetailItemTitle(null);
      }}
    >
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
        {detailItem ? (
          <BrowseDetailMenu
            item={detailItem}
            setMenuValue={setDetailItemTitle}
          />
        ) : (
          <BrowseRootMenu
            activeTitle={activeItem?.title}
            setMenuValue={setDetailItemTitle}
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const BrowseRootMenu = ({
  activeTitle,
  setMenuValue,
}: {
  activeTitle?: string;
  setMenuValue: SetMenuValue;
}) => (
  <>
    <div className="px-4 py-3 text-center text-sm font-medium">Browse</div>
    <DropdownMenuSeparator className="m-0 bg-white/8" />

    <div className="space-y-3 p-3">
      <p className="px-1 text-xs font-normal tracking-wide text-muted-foreground">
        Content
      </p>
      <div className="grid grid-cols-2 gap-2">
        {navigation.items.map((item) => {
          const Icon = getNavIcon(item);
          const isActive = item.title === activeTitle;
          const tileClassName = cn(
            "group flex h-[72px] cursor-pointer flex-col items-start justify-between rounded-md border border-white/10 bg-card/55 p-3 text-left text-white outline-hidden transition-all",
            "hover:border-white/25 hover:bg-white/8 focus:border-primary/35 focus:bg-primary/10",
            isActive &&
              "border-primary/35 bg-primary/10 text-primary ring-1 ring-primary/25",
          );

          if (!hasBrowseSubmenu(item)) {
            return (
              <DropdownMenuItem
                key={item.title}
                asChild
                className="rounded-md p-0 focus:bg-transparent"
              >
                <Link href={item.href} className={tileClassName}>
                  <div className="flex w-full items-center justify-between">
                    <Icon className="size-5" strokeWidth={1.65} />
                    {isActive && (
                      <Check className="size-4" strokeWidth={1.75} />
                    )}
                  </div>
                  <span className="text-sm font-normal text-white">
                    {toTitleCase(item.title)}
                  </span>
                </Link>
              </DropdownMenuItem>
            );
          }

          return (
            <DropdownMenuItem
              key={item.title}
              onSelect={(event) => {
                event.preventDefault();
                setMenuValue(item.title);
              }}
              className={tileClassName}
            >
              <div className="flex w-full items-center justify-between">
                <Icon className="size-5" strokeWidth={1.65} />
                {isActive ? (
                  <Check className="size-4" strokeWidth={1.75} />
                ) : (
                  <ChevronRight
                    className="size-4 opacity-55 transition group-hover:translate-x-0.5 group-hover:opacity-90"
                    strokeWidth={1.75}
                  />
                )}
              </div>
              <span className="text-sm font-normal text-white">
                {toTitleCase(item.title)}
              </span>
            </DropdownMenuItem>
          );
        })}
      </div>
    </div>
  </>
);

const BrowseDetailMenu = ({
  item,
  setMenuValue,
}: {
  item: NavItem;
  setMenuValue: SetMenuValue;
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const Icon = getNavIcon(item);

  return (
    <>
      <div className="flex items-center gap-2 px-2 py-2">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            setMenuValue(null);
          }}
          className="size-9 cursor-pointer justify-center rounded-md p-0 text-muted-foreground hover:text-white focus:bg-white/10 focus:text-white"
          aria-label="back to browse"
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </DropdownMenuItem>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 pr-9 text-sm font-medium">
          <Icon className="size-4 text-primary" strokeWidth={1.65} />
          <span>{toTitleCase(item.title)}</span>
        </div>
      </div>

      <DropdownMenuSeparator className="m-0 bg-white/8" />

      <div className="p-2">
        <div className="grid grid-cols-2 gap-2">
          {getBrowseLinks(item).map((child) => {
            const isActive = isCurrentHref(pathname, searchParams, child.href);

            return (
              <DropdownMenuItem
                key={child.href}
                asChild
                className="rounded-[10px] p-0 focus:bg-transparent"
              >
                <Link
                  href={child.href}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center justify-between rounded-[10px] border border-white/10 bg-card/45 px-3 py-2.5 text-sm font-normal text-white outline-hidden transition-all",
                    "hover:border-primary/35 hover:bg-primary/10 focus:border-primary/35 focus:bg-primary/10",
                    isActive && "border-primary/40 bg-primary/12 text-primary",
                  )}
                >
                  <span>{getBrowseLinkLabel(item, child)}</span>
                  {isActive && <Check className="size-4" strokeWidth={1.75} />}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>
      </div>
    </>
  );
};
