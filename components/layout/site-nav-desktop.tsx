"use client";

import { navigation, type NavItem } from "@/config/site";
import { useActiveNav } from "@/hooks";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import Link from "next/link";
import { useState } from "react";

type SetMenuValue = (value: string) => void;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const SiteNavDesktop = () => {
  const [menuValue, setMenuValue] = useState<string>("");

  return (
    <NavigationMenu
      className="hidden lg:flex"
      value={menuValue}
      onValueChange={setMenuValue}
    >
      <NavigationMenuList>
        {navigation.items.map((item) =>
          item.items ? (
            <SiteNavItem
              key={item.title}
              {...item}
              setMenuValue={setMenuValue}
            />
          ) : (
            <SiteNavItemSingle key={item.title} {...item} />
          ),
        )}
      </NavigationMenuList>
    </NavigationMenu>
  );
};

const SiteNavItem = ({
  title,
  items,
  href,
  description,
  setMenuValue,
}: NavItem & { setMenuValue: SetMenuValue }) => {
  const isActive = useActiveNav(href);

  return (
    <NavigationMenuItem value={title}>
      <div
        className={cn(
          "flex items-center rounded-full",
          isActive
            ? "border border-primary/20 bg-primary/8 dark:border-white/15 dark:bg-white/[0.08]"
            : "hover:border-border/30 hover:bg-muted/30 focus-within:border-border/30 focus-within:bg-muted/30 dark:hover:border-white/10 dark:hover:bg-white/[0.05] dark:focus-within:border-white/10 dark:focus-within:bg-white/[0.05]",
        )}
      >
        <NavigationMenuLink asChild>
          <Link
            href={href}
            onClick={() => setMenuValue("")}
            className={cn(
              navigationMenuTriggerStyle(),
              "gap-2 rounded-r-none border-0 bg-transparent shadow-none hover:bg-transparent focus:bg-transparent",
              focusRing,
            )}
          >
            {title}
          </Link>
        </NavigationMenuLink>
        <NavigationMenuTrigger
          showChevron
          className={cn(
            navigationMenuTriggerStyle(),
            "min-h-10 min-w-9 shrink-0 rounded-l-none border-0 bg-transparent px-1.5 shadow-none hover:bg-transparent focus:bg-transparent",
            focusRing,
          )}
        >
          <span className="sr-only">Open {title} submenu</span>
        </NavigationMenuTrigger>
      </div>
      <NavigationMenuContent>
        <div className="p-6 pb-0">
          {title}
          <p className="mt-2 text-sm">{description}</p>
        </div>
        <div className="grid w-[650px] grid-cols-2 p-4">
          {items?.map((child) => (
            <SiteNavListItem key={child.title} {...child} />
          ))}
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

const SiteNavItemSingle = ({ title, href }: NavItem) => {
  const isActive = useActiveNav(href);

  return (
    <NavigationMenuItem>
      <NavigationMenuLink asChild>
        <Link
          href={href}
          className={cn(
            navigationMenuTriggerStyle(),
            isActive &&
              "border border-primary/20 bg-primary/8 dark:border-white/15 dark:bg-white/[0.08]",
            "gap-2",
          )}
        >
          {title}
        </Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
};

const SiteNavListItem = ({ title, description, href }: NavItem) => {
  return (
    <NavigationMenuLink asChild>
      <Link
        href={href}
        className="select-none space-y-2 rounded-md border border-transparent p-3 hover:border-border/50 hover:bg-muted/40 dark:hover:border-white/15 dark:hover:bg-white/10"
      >
        <div className="text-sm font-medium leading-none">
          {title}
          {title === "Discover" && (
            <Badge className="ml-2 px-1 py-0 text-[9px] leading-normal tracking-wide">
              NEW
            </Badge>
          )}
        </div>
        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
          {description}
        </p>
      </Link>
    </NavigationMenuLink>
  );
};
