"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const useDialog = () => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return [open, setOpen] as const;
};
