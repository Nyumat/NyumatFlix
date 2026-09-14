"use client";

import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { useEffect } from "react";

export function CatalogCardStyleSync() {
  const catalogCardStyle = useAppSettingsStore(
    (state) => state.catalogCardStyle,
  );

  useEffect(() => {
    document.documentElement.dataset.catalogCardStyle = catalogCardStyle;
    return () => {
      delete document.documentElement.dataset.catalogCardStyle;
    };
  }, [catalogCardStyle]);

  return null;
}
