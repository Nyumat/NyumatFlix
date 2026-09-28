"use client";

import { useEffect, type ReactNode } from "react";

export function FfsScrollRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("ffs-admin-root");
    return () => {
      document.documentElement.classList.remove("ffs-admin-root");
    };
  }, []);

  return children;
}
