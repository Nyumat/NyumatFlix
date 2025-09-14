"use client";

import { NavbarSearchClient } from "@/components/search/search";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogIn, Menu, X } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { UserAvatar } from "./user-avatar";

/**
 * Navigation link configuration
 */
interface NavLink {
  /** Display text for the link */
  label: string;
  /** URL path for the link */
  href: string;
  /** Whether this is an external link */
  external?: boolean;
}

/**
 * Navigation links configuration
 */
const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/home" },
  { label: "Movies", href: "/movies" },
  { label: "TV Shows", href: "/tvshows" },
  { label: "Search", href: "/search" },
];

/**
 * Navbar component provides the main navigation for the application
 * Features: responsive design, mobile menu, search integration, theme toggle
 * @returns A responsive navigation bar with search and theme controls
 */
export const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const isActiveLink = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
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

          {/* Desktop Search - Centered and responsive */}
          <div className="hidden md:flex flex-1 justify-center px-4 max-w-2xl">
            <div className="w-full max-w-lg">
              <NavbarSearchClient />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 whitespace-nowrap ${
                  isActiveLink(link.href)
                    ? "bg-primary/20 text-primary focus-visible:ring-0 active:bg-primary/20 focus:ring-0 hover:bg-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent hover:border-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side controls */}
          <div className="flex items-center space-x-2">
            {/* Authentication */}
            {session ? (
              <UserAvatar session={session} />
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="hidden md:flex">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
              </Link>
            )}

            {/* <Link
              href="https://github.com/nyumat/nyumatflix"
              target="_blank"
              rel="noopener noreferrer"
              className="size-8 ml-2 relative group flex items-center justify-center"
            >
              <Github className="stroke-fuchsia-600" />
              <span className="absolute -inset-1 rounded-md border-2 border-fuchsia-600 scale-0 opacity-0 group-hover:scale-110 group-hover:opacity-100 transition-all duration-300 origin-center" />
            </Link> */}

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMobileMenu}
                aria-label="Toggle mobile menu"
                className="h-10 w-10"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Mobile Search - Full width with padding */}
              <div className="px-3 py-3">
                <NavbarSearchClient />
              </div>

              {/* Mobile Navigation Links */}
              <div className="space-y-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`block px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 ${
                      isActiveLink(link.href)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}

                {/* Mobile Authentication */}
                {session ? (
                  <div className="px-3 py-3">
                    <UserAvatar session={session} />
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="block px-3 py-3 rounded-md text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <LogIn className="inline mr-2 h-4 w-4" />
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
