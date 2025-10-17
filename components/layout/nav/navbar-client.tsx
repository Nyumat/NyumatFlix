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
import { NavbarMobileNavigation } from "./navbar-mobile-navigation";

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
    <nav
      className={cn(
        "absolute top-3 z-30 w-full",
        "bg-black/90 md:bg-transparent",
      )}
    >
      <div className="flex justify-between items-center md:max-w-7xl lg:max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:pb-8">
        <div className="flex flex-row items-center gap-2">
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

        {/* search bar for desktop */}
        <div className="hidden md:flex flex-1 mx-8">
          <NavbarSearchClient />
        </div>

        <div className="hidden md:flex items-center space-x-1 lg:space-x-2 ml-auto">
          <NavbarLinks links={NAV_LINKS} />
          <NavbarAuth session={session} />
        </div>

        <div className="flex md:hidden items-center space-x-2">
          <NavbarMobileNavigation links={NAV_LINKS}>
            <div className="px-2">
              <NavbarSearchClient />
            </div>
          </NavbarMobileNavigation>
        </div>
      </div>
    </nav>
  );
};
