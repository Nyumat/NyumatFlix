"use client";

import dynamic from "next/dynamic";

export const DynamicAsyncContentRow = dynamic(
  () => import("./async-content-row").then((m) => m.AsyncContentRow),
  { ssr: false },
);
