"use client";

import { scrollToTop } from "@/components/layout/route-scroll-reset";
import { DetailTabPanelsLoading } from "@/components/layout/page-loading/detail-page-loading";
import { useLayoutEffect } from "react";

export default function MovieDetailLoading() {
  useLayoutEffect(() => {
    scrollToTop();
  }, []);

  return <DetailTabPanelsLoading />;
}
