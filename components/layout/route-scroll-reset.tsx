"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const scrollToTop = () => {
  const html = document.documentElement;
  const previous = html.style.scrollBehavior;

  html.style.scrollBehavior = "auto";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  html.style.scrollBehavior = previous;
};

export const stabilizeScrollTop = (
  delaysMs: number[] = [0, 50, 150, 400, 550, 700],
) => {
  scrollToTop();
  for (const delay of delaysMs) {
    if (delay === 0) {
      requestAnimationFrame(scrollToTop);
      continue;
    }
    window.setTimeout(scrollToTop, delay);
  }
};

const isMediaDetailPath = (pathname: string) =>
  /^\/(?:movies|tvshows|collection|person)\/[^/?#]+$/.test(pathname);

export const RouteScrollReset = () => {
  const pathname = usePathname();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const [isFreshNavigating, setIsFreshNavigating] = useState(false);
  const pendingDetailNavRef = useRef(false);

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
      if (
        nextUrl.pathname === window.location.pathname &&
        nextUrl.search === window.location.search
      ) {
        return;
      }

      if (isMediaDetailPath(nextUrl.pathname)) {
        event.preventDefault();
        pendingDetailNavRef.current = true;
        setIsFreshNavigating(true);
        scrollToTop();

        const href = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
        window.setTimeout(() => {
          routerRef.current.push(href, { scroll: false });
        }, 50);
        return;
      }

      scrollToTop();
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useLayoutEffect(() => {
    scrollToTop();

    if (isMediaDetailPath(pathname)) {
      stabilizeScrollTop([0, 50, 150, 400]);
    }

    if (!pendingDetailNavRef.current) {
      return;
    }

    let cancelled = false;
    const finishTransition = () => {
      if (cancelled) return;
      pendingDetailNavRef.current = false;
      setIsFreshNavigating(false);
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(finishTransition);
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!isFreshNavigating) return null;

  return (
    <div className="fixed inset-0 z-[2147483647] grid place-items-center bg-neutral-950 text-foreground">
      <div
        className="size-10 animate-spin rounded-full border-3 border-white/10 border-t-primary/80"
        aria-label="Loading"
      />
    </div>
  );
};
