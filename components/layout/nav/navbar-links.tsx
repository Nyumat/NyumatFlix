"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  const isActiveLink = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  const linkClasses = isMobile
    ? "block px-3 py-3 rounded-md text-base font-medium transition-colors duration-200"
    : "px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 whitespace-nowrap";

  const activeClasses = isMobile
    ? "bg-primary text-primary-foreground"
    : "bg-primary/20 text-primary focus-visible:ring-0 active:bg-primary/20 focus:ring-0 hover:bg-primary/20";

  const inactiveClasses = isMobile
    ? "text-muted-foreground hover:text-foreground hover:bg-accent"
    : "text-muted-foreground hover:text-foreground hover:bg-accent hover:border-primary";

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

  return (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            linkClasses,
            isActiveLink(link.href) ? activeClasses : inactiveClasses,
          )}
          onMouseEnter={() => handleLinkInteraction(link)}
          onFocus={() => handleLinkInteraction(link)}
          onClick={isMobile ? onMobileLinkClick : undefined}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
};
