"use client";

import {
  readWebAuthnClientFeatures,
  type WebAuthnClientFeatureSupport,
} from "@/lib/passkeys/client-capabilities";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { useEffect, useState } from "react";

export function usePasskeyCapabilities(): WebAuthnClientFeatureSupport | null {
  const isHydrated = useIsHydrated();
  const [features, setFeatures] = useState<WebAuthnClientFeatureSupport | null>(
    null,
  );

  useEffect(() => {
    if (!isHydrated) return;
    let active = true;
    void readWebAuthnClientFeatures().then((result) => {
      if (active) setFeatures(result);
    });
    return () => {
      active = false;
    };
  }, [isHydrated]);

  return features;
}
