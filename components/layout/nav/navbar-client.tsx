"use client";

import { NavbarSearchClient } from "@/components/search/search";
import { cn } from "@/lib/utils";
import { Session } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "../../ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { NavbarAuth } from "./navbar-auth";
import { NavbarLinks } from "./navbar-links";
import { NavbarMobileMenu } from "./navbar-mobile-menu";

interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/home" },
  { label: "Movies", href: "/movies" },
  { label: "TV Shows", href: "/tvshows" },
  { label: "Search", href: "/search" },
];

interface NavbarClientProps {
  session: Session | null;
}

export const NavbarClient = ({ session }: NavbarClientProps) => {
  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex flex-row justify-center items-center gap-2">
            <Link href="/">
              <Image
                src="/logo.svg"
                alt="NyumatFlix Logo"
                width={150}
                height={150}
                className="size-10"
              />
            </Link>
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  className={cn(
                    "text-xs",
                    "bg-primary/10 hover:bg-primary/20 text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "animate-pulse rounded-full px-2 py-1 text-primary font-bold",
                      "text-yellow-500 scale-150",
                    )}
                  >
                    •
                  </span>
                  Beta
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>You're using the NyumatFlix 3.0 Beta</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="hidden md:flex flex-1 justify-center px-4 max-w-2xl">
            <div className="w-full max-w-lg">
              <NavbarSearchClient />
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
            <NavbarLinks links={NAV_LINKS} />
          </div>
          <div className="flex items-center space-x-2">
            <NavbarAuth session={session} />
            {/* <Link
              href="https://github.com/nyumat/nyumatflix"
              target="_blank"
              rel="noopener noreferrer"
              className="size-8 ml-2 relative group flex items-center justify-center"
            >
              <Github className="stroke-fuchsia-600" />
              <span className="absolute -inset-1 rounded-md border-2 border-fuchsia-600 scale-0 opacity-0 group-hover:scale-110 group-hover:opacity-100 transition-all duration-300 origin-center" />
            </Link> */}
            <NavbarMobileMenu>
              <div className="px-3 py-3">
                <NavbarSearchClient />
              </div>
              <div className="space-y-1">
                <NavbarLinks links={NAV_LINKS} isMobile />
                <NavbarAuth session={session} isMobile />
              </div>
            </NavbarMobileMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};
