"use client";

import { useSession } from "next-auth/react";

export function useSignedInWatchlistEnabled(extraEnabled = true): boolean {
  const { data: session, status } = useSession();

  return (
    extraEnabled && status !== "loading" && Boolean(session?.user?.id)
  );
}
