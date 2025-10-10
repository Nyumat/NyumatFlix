"use client";

import { CopycatWarning } from "@/components/landing/copycat-warning";
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
    <nav className="absolute top-0 z-50 w-full">
      <CopycatWarning />
      <div className="flex md:max-w-8xl lg:max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-8">
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
        <div className="hidden md:flex flex-1"></div>
        <div className="flex items-center space-x-1 lg:space-x-2">
          <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <NavbarLinks links={NAV_LINKS} />
          </div>
          <NavbarAuth session={session} />
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
