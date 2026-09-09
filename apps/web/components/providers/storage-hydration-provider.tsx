"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

import {
  clearSignedInLedger,
  resetGuestLedger,
} from "@/lib/playback/progress-ledger-facade";
import { hydrateSignedInPlaybackLedger } from "@/lib/playback/hydrate-playback-ledger";
import { hydrateUserSettings } from "@/lib/user/hydrate-user-settings";

export function StorageHydrationProvider() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!session?.user?.id) {
      clearSignedInLedger();
      resetGuestLedger();
      return;
    }

    void Promise.all([
      hydrateSignedInPlaybackLedger(),
      hydrateUserSettings(),
    ]);
  }, [session?.user?.id, status]);

  return null;
}
