"use client";

import { usePathname } from "next/navigation";

export const useActiveNav = (href: string) => {
  const pathname = usePathname();

  if (!pathname) {
    return false;
  }

  if (href === "/") {
    return pathname === href;
  }
  if (href === "/movies" || href === "/tvshows") {
    return pathname === href;
  }
  return pathname.startsWith(href);
};
