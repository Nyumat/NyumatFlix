"use client";

import { stabilizeScrollTop } from "@/components/layout/route-scroll-reset";
import { useLayoutEffect } from "react";

type MediaDetailScrollResetProps = {
  restoreKey: string;
};

export const MediaDetailScrollReset = ({
  restoreKey,
}: MediaDetailScrollResetProps) => {
  useLayoutEffect(() => {
    const stabilize = stabilizeScrollTop([0, 50, 150, 400]);
    return () => stabilize.cancel();
  }, [restoreKey]);

  return null;
};
