"use client";

import { useLayoutEffect } from "react";

type MediaDetailScrollResetProps = {
  restoreKey: string;
};

export const MediaDetailScrollReset = ({
  restoreKey,
}: MediaDetailScrollResetProps) => {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    html.style.scrollBehavior = previous;
  }, [restoreKey]);

  return null;
};
