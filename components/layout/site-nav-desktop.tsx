"use client";

import {
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
import { cn } from "@/lib/utils";
import {
  Check,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Flame,
  LayoutGrid,
  Tv,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

type SetMenuValue = (value: string | null) => void;
type BrowseLink = Pick<NavItem, "href" | "title">;

const parentIcons: Record<string, LucideIcon> = {
  Movies: Clapperboard,
  "TV Shows": Tv,
  Anime: BookOpen,
  People: Users,
  Trending: Flame,
};

const getNavIcon = (item: NavItem) => parentIcons[item.title] ?? LayoutGrid;

const toTitleCase = (label: string) =>
  label.replace(/\w\S*/g, (word) =>
    word === word.toUpperCase()
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );

const getSearchValue = (searchParams: URLSearchParams, key: string) =>
  searchParams.get(key) ?? undefined;

const getHrefParts = (href: string) => {
  const [path, query = ""] = href.split("?");
  return {
    path,
    params: new URLSearchParams(query),
  };
};

const getBrowseLinkLabel = (item: NavItem, child: BrowseLink) => {
  if (child.href === item.href || child.title === "Discover") {
    return "All";
  }

  if (child.title === "On The Air") {
    return "Actively Releasing";
  }

  return toTitleCase(child.title);
};

const getBrowseLinks = (item: NavItem): BrowseLink[] => {
  const children = item.items ?? [];
  const hasRootLink = children.some((child) => child.href === item.href);

  if (hasRootLink) {
    return children;
  }

  return [{ href: item.href, title: "All" }, ...children];
};

const isCurrentHref = (
  pathname: string,
  searchParams: URLSearchParams,
  href: string,
) => {
  const { path, params } = getHrefParts(href);

  if (pathname !== path) return false;

  const expectedView = params.get("view");
  const currentView = searchParams.get("view");
  const expectedDepartment = params.get("department");
  const expectedGender = params.get("gender");

  if (expectedView) {
    return currentView === expectedView;
  }

  if (expectedDepartment) {
    return (
      searchParams.get("department") === expectedDepartment &&
      searchParams.get("gender") === expectedGender
    );
  }

  if (params.size > 0) {
    for (const [key, value] of params.entries()) {
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  }

  if (path === "/movies" || path === "/tvshows") {
    return !currentView || currentView === "discover";
  }

  if (path === "/people/popular") {
    return (
      !getSearchValue(searchParams, "department") &&
      !getSearchValue(searchParams, "gender")
    );
  }

  return true;
};

const isInNavGroup = (
  pathname: string,
  searchParams: URLSearchParams,
  item: NavItem,
) => {
  if (
    item.items?.some((child) =>
      isCurrentHref(pathname, searchParams, child.href),
    )
  ) {
    return true;
  }

  if (isCurrentHref(pathname, searchParams, item.href)) {
    return true;
  }

  if (item.href === "/movies") {
    return (
      pathname.startsWith("/movies") &&
      (!searchParams.get("view") || searchParams.get("view") === "discover")
    );
  }

  if (item.href === "/tvshows") {
    return (
      pathname.startsWith("/tvshows") &&
      (!searchParams.get("view") || searchParams.get("view") === "discover")
    );
  }
  if (item.href === "/people/popular") return pathname.startsWith("/people");
  if (item.href === "/trending") return pathname.startsWith("/trending");
  if (item.href === "/anime") return pathname.startsWith("/anime");

  return false;
};

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
            "hidden lg:inline-flex",
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

          return (
            <DropdownMenuItem
              key={item.title}
              onSelect={(event) => {
                event.preventDefault();
                setMenuValue(item.title);
              }}
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
