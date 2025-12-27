"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

interface NavbarLinksProps {
  links: NavLink[];
  isMobile?: boolean;
  onMobileLinkClick?: () => void;
}

export const NavbarLinks = ({
  links,
  isMobile = false,
  onMobileLinkClick,
}: NavbarLinksProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isActiveLink = (href: string) => {
    if (!isMounted) return false;
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const linkClasses = isMobile
    ? "block px-3 py-3 rounded-md text-base font-medium transition-all duration-200"
    : "relative px-4 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap";

  const activeClasses = isMobile
    ? "bg-primary text-primary-foreground"
    : "text-white font-semibold drop-shadow-lg";

  const inactiveClasses = isMobile
    ? "text-muted-foreground hover:text-foreground hover:bg-accent"
    : "text-white/80 hover:text-white font-medium drop-shadow-md hover:drop-shadow-lg";

  const handleLinkInteraction = (link: NavLink) => {
    router.prefetch(link.href);
    if (link.href === "/movies") {
      router.prefetch("/movies/browse");
      router.prefetch("/home");
    } else if (link.href === "/tvshows") {
      router.prefetch("/tvshows/browse");
      router.prefetch("/home");
    } else if (link.href === "/home") {
      router.prefetch("/movies");
      router.prefetch("/tvshows");
    } else if (link.href === "/search") {
      router.prefetch("/movies");
      router.prefetch("/tvshows");
    }
  };

  const handleMouseEnter = (link: NavLink) => {
    router.prefetch(link.href);
  };

  return (
    <div className={cn(!isMobile && "group flex items-center flex-nowrap")}>
      {links.map((link) => {
        const isHomeLink = link.href === "/home" && !isMobile;
        const isActive = isActiveLink(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              linkClasses,
              isActive ? activeClasses : inactiveClasses,
              !isMobile &&
                "after:absolute after:bottom-0 after:left-1/2 after:w-3/4 after:h-px after:bg-pink-500 after:origin-center after:-translate-x-1/2 after:transition-transform after:duration-300 after:ease-in-out",
              !isMobile &&
                (isActive
                  ? "after:scale-x-100 group-hover:after:scale-x-0"
                  : "after:scale-x-0 hover:after:scale-x-100"),
              isHomeLink && "hidden lg:inline",
            )}
            onMouseEnter={() => handleMouseEnter(link)}
            onFocus={() => handleLinkInteraction(link)}
            onClick={isMobile ? onMobileLinkClick : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
};
