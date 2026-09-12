"use client";

import { isCapDevBypassEnabled } from "@/lib/cap/constants";
import { warmCapWidgetAssets } from "@/lib/cap/warmup-client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const CAP_WARMUP_ROUTE =
  /^\/(?:movies|tvshows|anime)\/[^/]+(?:\/.*)?$|^\/live(?:\/|$)/;

const isCapWarmupRoute = (pathname: string) => CAP_WARMUP_ROUTE.test(pathname);

export function CapWarmup() {
  const pathname = usePathname();

  useEffect(() => {
    if (isCapDevBypassEnabled() || !isCapWarmupRoute(pathname)) return;
    void warmCapWidgetAssets().catch(() => undefined);
  }, [pathname]);

  return null;
}
