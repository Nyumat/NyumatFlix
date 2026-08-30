"use client";

import { useIsHydrated } from "@/hooks/use-is-hydrated";

export const useClientMounted = () => useIsHydrated();
