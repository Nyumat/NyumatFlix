"use client";

import { SiteNav } from "@/components/layout/site-nav";
import { NavbarSearchClient } from "@/components/search/search";
import { cn } from "@/lib/utils";
import type { Session } from "next-auth";
import { BackButton } from "../../ui/back-button";
import { NavbarAuth } from "./navbar-auth";
import { NavbarMobileNavigation } from "./navbar-mobile-navigation";

const MOBILE_LINKS = [
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
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 sm:px-6 lg:gap-3 lg:px-8">
        <div className="flex shrink-0 items-center gap-1 lg:gap-2">
          <BackButton />
        </div>

        <SiteNav />

        <div className="hidden min-w-0 flex-1 md:flex md:justify-center md:px-4">
          <NavbarSearchClient />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex">
            <NavbarAuth session={session} />
          </div>
          <div className="flex md:hidden">
            <NavbarMobileNavigation links={MOBILE_LINKS} session={session}>
              <div className="px-2 pb-2">
                <NavbarSearchClient />
              </div>
            </NavbarMobileNavigation>
          </div>
        </div>
      </div>
    </header>
  );
};
