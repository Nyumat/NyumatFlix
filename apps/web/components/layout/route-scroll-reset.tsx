"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  commitNavigationEntry,
  consumePendingRouteSnapshot,
  findSnapshotAnchor,
  getRelativeUrl,
  readRouteSnapshot,
  recordNavigationOrigin,
  subscribePendingRouteRestore,
  type RouteSnapshot,
} from "@/lib/navigation/route-restoration";
import {
  captureAllCarouselScrollProgresses,
  captureCarouselScrollProgress,
  revealCarouselItem,
  restorePageCarouselScrolls,
} from "@/components/ui/carousel";

export const scrollToTop = () => {
  const html = document.documentElement;
  const previous = html.style.scrollBehavior;

  html.style.scrollBehavior = "auto";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  html.style.scrollBehavior = previous;
};

type StabilizeScrollTopHandle = {
  cancel: () => void;
};

let activeStabilize: StabilizeScrollTopHandle | null = null;

export const stabilizeScrollTop = (
  delaysMs: number[] = [0, 50, 150, 400, 550, 700],
): StabilizeScrollTopHandle => {
  activeStabilize?.cancel();

  const timeouts: number[] = [];
  let rafId = 0;
  let cancelled = false;

  const run = () => {
    if (cancelled) return;
    scrollToTop();
  };

  run();
  for (const delay of delaysMs) {
    if (delay === 0) {
      rafId = window.requestAnimationFrame(run);
      continue;
    }
    timeouts.push(window.setTimeout(run, delay));
  }

  const handle: StabilizeScrollTopHandle = {
    cancel: () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      for (const timeout of timeouts) window.clearTimeout(timeout);
      if (activeStabilize === handle) activeStabilize = null;
    },
  };

  activeStabilize = handle;
  return handle;
};

const cancelActiveStabilize = () => {
  activeStabilize?.cancel();
};

const isMediaDetailPath = (pathname: string) =>
  /^\/(?:movies|tvshows|collection|person)\/[^/?#]+$/.test(pathname);

export const RouteScrollReset = () => {
  const pathname = usePathname();
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const [isFreshNavigating, setIsFreshNavigating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const pendingDetailNavRef = useRef(false);
  const popNavigationRef = useRef(false);

  useEffect(() => {
    return subscribePendingRouteRestore((active) => {
      if (active) setIsRestoring(true);
    });
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const handlePopState = () => {
      popNavigationRef.current = true;
    };

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

      recordNavigationOrigin(nextUrl, anchor, {
        carouselScrollProgress:
          captureCarouselScrollProgress(anchor) ?? undefined,
        pageCarouselScrolls: captureAllCarouselScrollProgresses(),
      });

      if (isMediaDetailPath(nextUrl.pathname)) {
        event.preventDefault();
        pendingDetailNavRef.current = true;
        setIsFreshNavigating(true);
        // Keep the list page's scroll position intact for soft-back restore.
        // Detail pages scroll themselves to top on mount.

        const href = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
        window.setTimeout(() => {
          routerRef.current.push(href, { scroll: false });
        }, 50);
        return;
      }

      scrollToTop();
    };

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  useLayoutEffect(() => {
    cancelActiveStabilize();

    const currentUrl = getRelativeUrl();
    commitNavigationEntry(currentUrl);
    const snapshot =
      consumePendingRouteSnapshot(currentUrl) ??
      (popNavigationRef.current ? readRouteSnapshot(currentUrl) : null);
    popNavigationRef.current = false;

    const shouldClearFreshNav = pendingDetailNavRef.current;
    let cancelled = false;
    const finishFreshNav = () => {
      if (cancelled) return;
      pendingDetailNavRef.current = false;
      setIsFreshNavigating(false);
    };

    if (snapshot) {
      if (shouldClearFreshNav) finishFreshNav();
      setIsRestoring(true);
      return restoreRouteSnapshot(snapshot, {
        onLanded: () => {
          if (!cancelled) setIsRestoring(false);
        },
      });
    }

    setIsRestoring(false);
    scrollToTop();

    // Soft-nav overlay must clear on detail arrival. Previously this returned
    // early for media detail paths and left the spinner stuck forever.
    if (shouldClearFreshNav) {
      requestAnimationFrame(() => {
        requestAnimationFrame(finishFreshNav);
      });
    }

    if (isMediaDetailPath(pathname)) {
      const stabilize = stabilizeScrollTop([0, 50, 150, 400]);
      return () => {
        cancelled = true;
        stabilize.cancel();
      };
    }

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!isFreshNavigating && !isRestoring) return null;

  return (
    <div className="fixed inset-0 z-[2147483647] grid place-items-center bg-neutral-950 text-foreground">
      <div
        className="size-10 animate-spin rounded-full border-3 border-white/10 border-t-primary/80"
        aria-label="Loading"
      />
    </div>
  );
};

const RESTORE_ATTEMPT_MS = [
  0, 50, 100, 150, 250, 400, 600, 800, 1200, 1800, 2500,
];

const SCROLL_SETTLE_PX = 4;

const isRestorePositionSettled = (
  snapshot: RouteSnapshot,
  options: {
    carouselsReady: boolean;
    revealOk: boolean;
    anchor: HTMLAnchorElement | null;
  },
) => {
  if (!options.carouselsReady || !options.revealOk) return false;

  // Prefer the saved card being on-screen. scrollIntoView can intentionally
  // drift from snapshot.scrollY when layout shifted under the spinner.
  if (snapshot.anchorHref) {
    if (!options.anchor) return false;
    const bounds = options.anchor.getBoundingClientRect();
    return bounds.bottom > 0 && bounds.top < window.innerHeight;
  }

  return (
    Math.abs(window.scrollY - snapshot.scrollY) <= SCROLL_SETTLE_PX &&
    Math.abs(window.scrollX - snapshot.scrollX) <= SCROLL_SETTLE_PX
  );
};

type RestoreRouteSnapshotOptions = {
  onLanded?: () => void;
};

const restoreRouteSnapshot = (
  snapshot: RouteSnapshot,
  options: RestoreRouteSnapshotOptions = {},
) => {
  let cancelled = false;
  let landed = false;
  const timeouts: number[] = [];
  let rafId = 0;
  let settleRafId = 0;
  let revealed = false;

  const removeUserListeners = () => {
    window.removeEventListener("wheel", onUserScrollIntent);
    window.removeEventListener("touchstart", onUserScrollIntent);
    window.removeEventListener("pointerdown", onUserScrollIntent);
  };

  const cancelDelayedRestore = () => {
    cancelled = true;
    if (rafId) window.cancelAnimationFrame(rafId);
    if (settleRafId) window.cancelAnimationFrame(settleRafId);
    for (const timeout of timeouts) window.clearTimeout(timeout);
  };

  const finishLanded = () => {
    if (cancelled || landed) return;
    landed = true;
    cancelDelayedRestore();
    removeUserListeners();
    options.onLanded?.();
  };

  const onUserScrollIntent = () => {
    finishLanded();
  };

  const restore = (isFinalAttempt = false) => {
    if (cancelled || landed) return;

    window.scrollTo({
      top: snapshot.scrollY,
      left: snapshot.scrollX,
      behavior: "auto",
    });

    let carouselsReady = true;
    if (snapshot.pageCarouselScrolls?.length) {
      const rootCount = document.querySelectorAll(
        "[data-carousel-root]",
      ).length;
      if (rootCount === snapshot.pageCarouselScrolls.length) {
        restorePageCarouselScrolls(snapshot.pageCarouselScrolls);
      } else {
        carouselsReady = false;
      }
    }

    const anchor = findSnapshotAnchor(snapshot);
    let revealOk = !snapshot.anchorHref;

    if (anchor) {
      const didReveal = revealCarouselItem(
        anchor,
        snapshot.carouselScrollProgress,
      );
      if (didReveal) revealed = true;

      const inCarousel = Boolean(anchor.closest("[data-carousel-root]"));
      revealOk = inCarousel ? didReveal : true;

      anchor.focus({ preventScroll: true });

      const bounds = anchor.getBoundingClientRect();
      const offscreen = bounds.bottom <= 0 || bounds.top >= window.innerHeight;

      if (offscreen && (isFinalAttempt || revealed)) {
        anchor.scrollIntoView({ block: "center", inline: "nearest" });
      }
    } else if (snapshot.anchorHref) {
      revealOk = false;
    }

    const settled =
      isFinalAttempt ||
      isRestorePositionSettled(snapshot, {
        carouselsReady,
        revealOk,
        anchor,
      });

    if (!settled) return;

    // Hold the overlay through one paint at the final position, then reveal.
    settleRafId = window.requestAnimationFrame(() => {
      settleRafId = window.requestAnimationFrame(() => {
        finishLanded();
      });
    });
  };

  const schedule = (delay: number, isFinal: boolean) => {
    if (delay === 0) {
      rafId = window.requestAnimationFrame(() => restore(isFinal));
      return;
    }
    timeouts.push(window.setTimeout(() => restore(isFinal), delay));
  };

  for (let i = 0; i < RESTORE_ATTEMPT_MS.length; i++) {
    schedule(RESTORE_ATTEMPT_MS[i]!, i === RESTORE_ATTEMPT_MS.length - 1);
  }

  window.addEventListener("wheel", onUserScrollIntent, { once: true });
  window.addEventListener("touchstart", onUserScrollIntent, { once: true });
  window.addEventListener("pointerdown", onUserScrollIntent, { once: true });

  return () => {
    cancelDelayedRestore();
    removeUserListeners();
    if (!landed) options.onLanded?.();
  };
};
