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
import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";

type SetMenuValue = (value: string) => void;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const SiteNav = () => {
  const [menuValue, setMenuValue] = useState<string>("");
  const [interactiveNav, setInteractiveNav] = useState(false);

  useLayoutEffect(() => {
    setInteractiveNav(true);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <Link href="/" className="shrink-0">
        <Image
          src="/logo.svg"
          alt="NyumatFlix"
          width={28}
          height={28}
          className="size-7"
        />
        <span className="sr-only">NyumatFlix</span>
      </Link>

      {!interactiveNav ? (
        <SiteNavStatic />
      ) : (
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
      )}
    </div>
  );
};

const SiteNavStatic = () => {
  return (
    <nav className="hidden lg:flex" aria-label="Main">
      <ul className="group flex flex-1 list-none items-center justify-center space-x-1">
        {navigation.items.map((item) =>
          item.items ? (
            <SiteNavStaticNested key={item.title} {...item} />
          ) : (
            <SiteNavStaticSingle key={item.title} {...item} />
          ),
        )}
      </ul>
    </nav>
  );
};

const SiteNavStaticNested = ({ title, href }: NavItem) => {
  const isActive = useActiveNav(href);

  return (
    <li>
      <div
        className={cn(
          "flex items-center rounded-md",
          isActive
            ? "border border-primary/35 bg-primary/10 dark:border-white/30 dark:bg-white/15"
            : "hover:border-border/60 hover:bg-muted/50 focus-within:border-border/60 focus-within:bg-muted/50 dark:hover:border-white/25 dark:hover:bg-white/10 dark:focus-within:border-white/25 dark:focus-within:bg-white/10",
        )}
      >
        <Link
          href={href}
          className={cn(
            navigationMenuTriggerStyle(),
            "gap-2 rounded-r-none border-0 bg-transparent shadow-none hover:bg-transparent focus:bg-transparent",
            focusRing,
          )}
        >
          {title}
        </Link>
      </div>
    </li>
  );
};

const SiteNavStaticSingle = ({ title, href }: NavItem) => {
  const isActive = useActiveNav(href);

  return (
    <li>
      <Link
        href={href}
        className={cn(
          navigationMenuTriggerStyle(),
          isActive &&
            "border border-primary/35 bg-primary/10 dark:border-white/30 dark:bg-white/15",
          "gap-2",
        )}
      >
        {title}
      </Link>
    </li>
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
          "flex items-center rounded-md",
          isActive
            ? "border border-primary/35 bg-primary/10 dark:border-white/30 dark:bg-white/15"
            : "hover:border-border/60 hover:bg-muted/50 focus-within:border-border/60 focus-within:bg-muted/50 dark:hover:border-white/25 dark:hover:bg-white/10 dark:focus-within:border-white/25 dark:focus-within:bg-white/10",
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
              "border border-primary/35 bg-primary/10 dark:border-white/30 dark:bg-white/15",
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

export { SiteNav };
