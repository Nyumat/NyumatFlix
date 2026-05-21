"use client";

import { useEffect } from "react";

export const ONBOARDING_SUPPRESSION_EVENT =
  "nyumatflix:onboarding-suppression-change";

export function OnboardingSuppression() {
  useEffect(() => {
    document.documentElement.dataset.onboardingSuppressed = "true";
    window.dispatchEvent(new Event(ONBOARDING_SUPPRESSION_EVENT));

    return () => {
      delete document.documentElement.dataset.onboardingSuppressed;
      window.dispatchEvent(new Event(ONBOARDING_SUPPRESSION_EVENT));
    };
  }, []);

  return null;
}
