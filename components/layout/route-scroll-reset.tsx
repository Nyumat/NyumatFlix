"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

const scrollToTop = () => {
  const html = document.documentElement;
  const previous = html.style.scrollBehavior;

  html.style.scrollBehavior = "auto";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  html.style.scrollBehavior = previous;
};

const isMediaDetailPath = (pathname: string) =>
  /^\/(?:movies|tvshows|collection|person)\/[^/?#]+$/.test(pathname);

export const RouteScrollReset = () => {
  const pathname = usePathname();
  const [isFreshNavigating, setIsFreshNavigating] = useState(false);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.pathname === window.location.pathname) return;

      if (isMediaDetailPath(nextUrl.pathname)) {
        event.preventDefault();
        setIsFreshNavigating(true);
        window.setTimeout(() => window.location.assign(nextUrl.href), 50);
        return;
      }

      scrollToTop();
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useLayoutEffect(() => {
    setIsFreshNavigating(false);
    scrollToTop();
  }, [pathname]);

  if (!isFreshNavigating) return null;

  return (
    <div className="fixed inset-0 z-[2147483647] grid place-items-center bg-background text-foreground">
      <div
        className="size-12 animate-spin rounded-full border-3 border-muted border-t-primary"
        aria-label="Loading"
      />
    </div>
  );
};
