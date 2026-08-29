"use client";

import { isCapDevBypassEnabled } from "@/lib/cap/constants";
import { warmCapWidgetAssets } from "@/lib/cap/warmup-client";
import { useEffect } from "react";

export function CapWarmup() {
  useEffect(() => {
    if (isCapDevBypassEnabled()) return;
    void warmCapWidgetAssets().catch(() => undefined);
  }, []);

  return null;
}
