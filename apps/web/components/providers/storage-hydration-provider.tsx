"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

import {
  clearSignedInLedger,
  resetGuestLedger,
} from "@/lib/playback/progress-ledger-facade";
import { hydrateSignedInPlaybackLedger } from "@/lib/playback/hydrate-playback-ledger";
import { hydrateUserSettings } from "@/lib/user/hydrate-user-settings";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { readAmbientGlowClient } from "@/lib/user/ambient-glow-store";
import {
  persistCatalogCardStyleClient,
  readCatalogCardStyleClient,
  readCatalogCardStyleFromDocumentCookie,
} from "@/lib/user/catalog-card-style-store";

export function StorageHydrationProvider() {
  const { data: session, status } = useSession();

  // Reconcile the zustand snapshot with whatever the blocking <head> script
  // restored (cookie/localStorage) before React's first client render. Store
  // module state is created before that script runs on hard navigations.
  useEffect(() => {
    const persistedStyle = readCatalogCardStyleClient();
    const persistedGlow = readAmbientGlowClient();
    const state = useAppSettingsStore.getState();
    const next: {
      catalogCardStyle?: typeof state.catalogCardStyle;
      ambientGlow?: boolean;
    } = {};

    if (persistedStyle && persistedStyle !== state.catalogCardStyle) {
      next.catalogCardStyle = persistedStyle;
    }
    if (
      persistedStyle &&
      readCatalogCardStyleFromDocumentCookie() !== persistedStyle
    ) {
      persistCatalogCardStyleClient(persistedStyle);
    }
    if (persistedGlow !== null && persistedGlow !== state.ambientGlow) {
      next.ambientGlow = persistedGlow;
    }
    if (Object.keys(next).length > 0) {
      useAppSettingsStore.setState(next);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    const userId = session?.user?.id;
    if (!userId) {
      clearSignedInLedger();
      resetGuestLedger();
      return;
    }

    void Promise.all([
      hydrateSignedInPlaybackLedger(userId),
      hydrateUserSettings(userId),
    ]);
  }, [session?.user?.id, status]);

  return null;
}
