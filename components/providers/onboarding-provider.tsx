"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { ONBOARDING_SUPPRESSION_EVENT } from "@/components/providers/onboarding-suppression";

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export const OnboardingProvider = ({ children }: OnboardingProviderProps) => {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [hasChecked, setHasChecked] = useState<boolean>(false);
  const [isSuppressed, setIsSuppressed] = useState<boolean>(false);

  useEffect(() => {
    const syncSuppressionState = () => {
      const nextIsSuppressed =
        document.documentElement.dataset.onboardingSuppressed === "true";

      setIsSuppressed(nextIsSuppressed);

      if (nextIsSuppressed) {
        setShowOnboarding(false);
      }
    };

    syncSuppressionState();
    window.addEventListener(ONBOARDING_SUPPRESSION_EVENT, syncSuppressionState);

    return () => {
      window.removeEventListener(
        ONBOARDING_SUPPRESSION_EVENT,
        syncSuppressionState,
      );
    };
  }, [pathname]);

  useEffect(() => {
    if (isSuppressed) {
      setShowOnboarding(false);
      return;
    }

    if (status === "loading" || !session || hasChecked) {
      return;
    }

    // authenticated but has no name -> show onboarding
    // TODO: figure out what UX we want here.
    if (session?.user && !session.user.name) {
      setShowOnboarding(true);
    }

    setHasChecked(true);
  }, [hasChecked, isSuppressed, session, status]);

  useEffect(() => {
    setHasChecked(false);
  }, [pathname, session?.user?.id]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  return (
    <>
      {children}
      <OnboardingDialog
        open={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </>
  );
};
