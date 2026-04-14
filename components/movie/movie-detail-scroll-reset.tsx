"use client";

import { useParams } from "next/navigation";
import { useLayoutEffect } from "react";

/**
 * Scrolls the window to the top when entering `/movies/:id` (including
 * switching between ids). Only mounted under that route, so other navigations
 * are unaffected.
 */
export function MovieDetailScrollReset() {
  const params = useParams();
  const id = params?.id;

  useLayoutEffect(() => {
    if (id == null || Array.isArray(id)) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [id]);

  return null;
}
