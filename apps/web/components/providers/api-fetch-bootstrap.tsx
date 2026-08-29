"use client";

import { installBrowserApiFetch } from "@/lib/api/browser-fetch";

if (typeof window !== "undefined") {
  installBrowserApiFetch();
}

export const ApiFetchBootstrap = () => null;
