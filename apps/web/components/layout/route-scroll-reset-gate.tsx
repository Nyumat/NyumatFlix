"use client";

import { RouteScrollReset } from "@/components/layout/route-scroll-reset";
import { shouldSkipRouteScrollManagement } from "@/lib/ffs/ffs-host-paths";
import { usePathname } from "next/navigation";

export const RouteScrollResetGate = () => {
  const pathname = usePathname();
  const host = typeof window === "undefined" ? null : window.location.host;

  if (shouldSkipRouteScrollManagement(pathname, host)) {
    return null;
  }

  return <RouteScrollReset />;
};
