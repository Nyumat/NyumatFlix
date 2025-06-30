"use client";

import { ChevronsDown, Github, Menu, X } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Button } from "../ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "../ui/navigation-menu";
import { Separator } from "../ui/separator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { ToggleTheme } from "./toogle-theme";

interface RouteProps {
  href: string;
  label: string;
}

const mainRouteList: RouteProps[] = [
  {
    href: "/home",
    label: "Home",
  },
  {
    href: "/movies",
    label: "Movies",
  },
  {
    href: "/tvshows",
    label: "TV Shows",
  },
  {
    href: "/search",
    label: "Search",
  },
];

const mobileRouteList: RouteProps[] = [
  ...mainRouteList,
  {
    href: "/search",
    label: "Search",
  },
];

export const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-8">
        {/* Logo Section */}
        <Link
          href="/"
          className="flex items-center space-x-3"
          aria-label="NyumatFlix Home"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChevronsDown className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-foreground">
              NyumatFlix
            </span>
            <span className="text-xs text-muted-foreground hidden sm:block"></span>
          </div>
        </Link>
        <Separator
          orientation="vertical"
          className="hidden lg:block h-6 mx-6"
        />
        <NavigationMenu className="hidden lg:flex">
          <NavigationMenuList className="flex space-x-2">
            {mainRouteList.map(({ href, label }) => (
              <NavigationMenuItem key={href}>
                <NavigationMenuLink asChild>
                  <Link
                    href={href}
                    className="inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50"
                  >
                    {label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
        {/* Right Section */}
        <div className="ml-auto hidden lg:flex items-center space-x-2">
          <ToggleTheme />

          <Separator orientation="vertical" className="h-6 mx-4" />

          <Button variant="ghost" size="sm" className="h-10 w-10" asChild>
            <Link
              href="https://github.com/nyumat/nyumatflix"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on GitHub"
            >
              <Github className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <div className="ml-auto lg:hidden">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-10"
                aria-label={isOpen ? "Close menu" : "Open menu"}
              >
                {isOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </Button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="w-80 flex flex-col justify-between"
              aria-describedby="mobile-menu-description"
            >
              <div className="flex-1">
                <SheetHeader className="mb-6">
                  <SheetTitle className="flex items-center space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <ChevronsDown className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-lg font-bold text-foreground">
                        NyumatFlix
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Premium Streaming
                      </span>
                    </div>
                  </SheetTitle>
                </SheetHeader>

                <nav
                  className="flex flex-col space-y-2"
                  aria-label="Main navigation"
                  id="mobile-menu-description"
                >
                  {mobileRouteList.map(({ href, label }) => (
                    <Button
                      key={href}
                      variant="ghost"
                      className="justify-start h-12 px-4 text-base"
                      onClick={() => setIsOpen(false)}
                      asChild
                    >
                      <Link href={href}>{label}</Link>
                    </Button>
                  ))}
                </nav>
              </div>

              <SheetFooter className="flex-col space-y-4">
                <Separator />

                <div className="flex items-center justify-between w-full">
                  <ToggleTheme />

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10"
                    asChild
                  >
                    <Link
                      href="https://github.com/nyumat/nyumatflix"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="View on GitHub"
                    >
                      <Github className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="text-center pt-2">
                  <p className="text-xs text-muted-foreground">
                    © 2024 NyumatFlix. All rights reserved.
                  </p>
                </div>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
