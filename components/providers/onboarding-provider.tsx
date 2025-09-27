"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export const OnboardingProvider = ({ children }: OnboardingProviderProps) => {
  const { data: session, status } = useSession();
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [hasChecked, setHasChecked] = useState<boolean>(false);

  useEffect(() => {
    if (status === "loading" || !session || hasChecked) {
      return;
    }

    // authenticated but has no name -> show onboarding
    // TODO: figure out what UX we want here.
    if (session?.user && !session.user.name) {
      setShowOnboarding(true);
    }

    setHasChecked(true);
  }, [status]);

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
