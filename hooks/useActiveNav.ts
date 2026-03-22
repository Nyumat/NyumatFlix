"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const useActiveNav = (href: string) => {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
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
