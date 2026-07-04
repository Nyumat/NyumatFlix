"use client";

import { MediaDetailScrollReset } from "@/components/media/media-detail-scroll-reset";
import { usePathname } from "next/navigation";

export const PersonScrollReset = () => {
  const pathname = usePathname();
  return <MediaDetailScrollReset restoreKey={pathname} />;
};
